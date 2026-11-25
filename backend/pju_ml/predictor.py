"""Health assessment for one lamp from its recent telemetry.

``assess()`` returns a dict whose first keys match the backend ``predictions``
table (failure_probability, days_to_failure, risk_level, recommendation,
model_version, confidence), plus ``health_score``, ``issues``,
``component_health`` and ``battery`` / ``lamp`` blocks for the dashboard.

Three parts work together:

* a physics/rule engine with a learned baseline of normal behaviour
  (``Baseline``). Its thresholds are conservative: no false alarm on the
  recorded data;
* a coulomb-counting battery model (``pju_ml.battery``);
* optionally a Random Forest condition classifier (``pju_ml.training``)
  trained on fault-injected real data. It adds a warning for patterns the
  rules do not catch (milder faults), but never overrides a rule finding.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from pju_ml import __version__
from pju_ml import schema as S
from pju_ml.battery import BATTERY_MAX_BUS_V, BatterySpec, BatteryStatus, battery_status
from pju_ml.features import DEFAULT_WINDOW, build_features
from pju_ml.training import COMPONENT, LABEL_ID, NORMAL, ConditionModel

MODEL_VERSION = f"rules-{__version__}"
LOOKBACK = pd.Timedelta(hours=24)   # window for the rule checks
WINDOW_S = pd.Timedelta(DEFAULT_WINDOW).total_seconds()

SEVERITY_PENALTY = {"critical": 45, "warning": 20, "info": 5}
SEVERITY_ORDER = ["info", "warning", "critical"]
COMPONENTS = ("panel", "battery", "lamp", "sensor")


@dataclass
class Thresholds:
    min_windows: int = 3                 # 10-min windows needed before judging a period

    lamp_off_duty: float = 0.05          # night duty cycle below this = lamp not lighting
    lamp_dim_ratio: float = 0.5          # on-phase current below this x baseline = LED failing
    lamp_day_duty: float = 0.2           # duty above this in full sun = lamp stuck on

    ml_min_probability: float = 0.6      # forest vote share needed to count a window as faulty

    panel_underperform_ratio: float = 0.4  # panel yield below this x baseline = soiled/shaded
    current_residual_a: float = 0.3        # Kirchhoff residual above this = wiring/sensor fault
    min_coverage: float = 0.5

    # The controller reports "full" on most sunny days. Longer than this without
    # it means one (30 h) or two (54 h) charge days were missed.
    not_full_info_h: float = 30.0
    not_full_warning_h: float = 54.0
    days_to_empty_warning: float = 3.0
    days_to_empty_critical: float = 1.0


@dataclass
class Baseline:
    """Typical values of a healthy lamp, learned from historical windows."""

    yield_when_charging: float | None = None    # W per klux while charging in bright sun
    night_load_current_on: float | None = None   # A in the LED's PWM on-phase (dim mode)
    night_duty_cycle: float | None = None
    n_windows: int = 0
    source: str = ""

    @classmethod
    def fit(cls, features: pd.DataFrame, source: str = "") -> "Baseline":
        night = features[features["lux_mean"] < S.NIGHT_LUX]
        # Same lux regime as _check_charging, so the comparison is like for like.
        bright = features[features["lux_mean"] > S.BRIGHT_LUX]

        def med(series: pd.Series) -> float | None:
            series = series.dropna()
            return round(float(series.median()), 4) if len(series) else None

        return cls(
            yield_when_charging=med(bright["solar_yield_when_charging"]),
            night_load_current_on=med(night["load_current_when_on"]),
            night_duty_cycle=med(night["lamp_duty_cycle"]),
            n_windows=int(len(features)),
            source=source,
        )

    def save(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "Baseline":
        return cls(**json.loads(Path(path).read_text(encoding="utf-8")))


@dataclass
class Issue:
    code: str
    component: str
    severity: str
    message: str
    value: float | None = None

    def to_dict(self) -> dict:
        d = asdict(self)
        if d["value"] is not None:
            d["value"] = round(float(d["value"]), 4)
        return d


@dataclass
class _Context:
    all: pd.DataFrame
    latest: pd.Series
    dark: pd.DataFrame      # lux below NIGHT_LUX, any hour
    night: pd.DataFrame     # dark and between 19:00 and 05:00
    bright: pd.DataFrame    # lux above BRIGHT_LUX
    battery: BatteryStatus
    issues: list[Issue] = field(default_factory=list)


def _context(feats: pd.DataFrame, status: BatteryStatus) -> _Context:
    local_hour = feats["window_start"].dt.tz_convert(S.LOCAL_TZ).dt.hour
    dark = feats["lux_mean"] < S.NIGHT_LUX
    # Lamp checks only trust darkness at night hours: a covered light sensor
    # at noon must not look like "night with the lamp off".
    night = dark & ((local_hour >= 19) | (local_hour < 5))
    return _Context(
        all=feats,
        latest=feats.iloc[-1],
        dark=feats[dark],
        night=feats[night],
        bright=feats[feats["lux_mean"] > S.BRIGHT_LUX],
        battery=status,
    )


def _worse(a: str, b: str) -> str:
    return max(a, b, key=SEVERITY_ORDER.index)


def _check_sensors(c: _Context, th: Thresholds) -> None:
    if c.latest["temperature_missing_fraction"] >= 0.5:
        c.issues.append(Issue("SENSOR_TEMPERATURE", "sensor", "warning",
                              "Sensor suhu tidak terbaca (DS18B20 terlepas atau rusak)."))
    residual = c.all["current_balance_residual_mean"].median()
    if residual > th.current_residual_a:
        c.issues.append(Issue("SENSOR_INCONSISTENT", "sensor", "warning",
                              "Arus panel, baterai, dan beban tidak seimbang; periksa kabel atau sensor INA219.",
                              residual))
    coverage = c.all["coverage_ratio"].mean()
    if coverage < th.min_coverage:
        c.issues.append(Issue("DATA_GAPS", "sensor", "info",
                              "Banyak data yang tidak terkirim; periksa koneksi Wi-Fi/MQTT.", coverage))


def _rest_voltage(c: _Context) -> float | None:
    """Battery voltage from the most recent dark windows (bus = battery, light load)."""
    rest = c.dark["battery_voltage_rest"].dropna()
    if rest.empty:
        rest = c.all["battery_voltage_rest"].dropna()
    return float(rest.tail(3).median()) if len(rest) else None


def _check_battery(c: _Context, th: Thresholds, spec: BatterySpec) -> None:
    v = _rest_voltage(c)
    if v is not None and v < spec.critical_v:
        c.issues.append(Issue("BATTERY_CRITICAL", "battery", "critical",
                              f"Tegangan baterai {v:.2f} V, hampir atau sudah habis "
                              f"(batas aman {spec.chemistry} {spec.critical_v:.1f} V). "
                              "Periksa baterai dan pengisian.", v))
    elif v is not None and v < spec.low_v:
        c.issues.append(Issue("BATTERY_LOW", "battery", "warning",
                              f"Tegangan baterai rendah ({v:.2f} V); sisa muatan kecil.", v))

    hours = c.battery.hours_since_full
    days = c.battery.days_to_empty
    if hours is None:
        # No "full" moment on record at all, over enough data with good sun.
        observed = c.battery.observed_hours
        if c.battery.last_full_at is None and observed > th.not_full_info_h and len(c.bright) >= th.min_windows:
            c.issues.append(Issue("BATTERY_NOT_FULL", "battery", "info",
                                  f"Baterai tidak pernah tercatat penuh dalam {observed:.0f} jam data.",
                                  observed))
        return
    if hours <= th.not_full_info_h:
        return
    severity = "warning" if hours > th.not_full_warning_h else "info"
    message = f"Baterai belum terisi penuh selama {hours:.0f} jam."
    if days is not None:
        if days <= th.days_to_empty_critical:
            severity = _worse(severity, "critical")
        elif days <= th.days_to_empty_warning:
            severity = _worse(severity, "warning")
        message += f" Dengan pola sekarang, muatan diperkirakan habis dalam ±{days:.1f} hari."
    c.issues.append(Issue("BATTERY_NOT_FULL", "battery", severity, message, hours))


def _check_lamp(c: _Context, th: Thresholds, base: Baseline) -> None:
    if len(c.night) >= th.min_windows:
        duty = c.night["lamp_duty_cycle"].median()
        if duty < th.lamp_off_duty:
            battery_dead = any(i.code == "BATTERY_CRITICAL" for i in c.issues)
            cause = (" kemungkinan karena baterai habis" if battery_dead
                     else "; periksa LED, kabel lampu, atau controller")
            c.issues.append(Issue("LAMP_NOT_ON", "lamp", "critical",
                                  f"Lampu tidak menyala pada malam hari{cause}.", duty))
        else:
            on_current = c.night["load_current_when_on"].median()
            if base.night_load_current_on and on_current < th.lamp_dim_ratio * base.night_load_current_on:
                c.issues.append(Issue("LAMP_DIM", "lamp", "warning",
                                      f"Arus LED saat menyala {on_current * 1000:.0f} mA, jauh di bawah normal "
                                      f"({base.night_load_current_on * 1000:.0f} mA). Sebagian LED mungkin rusak.",
                                      on_current))
    lit_in_sun = c.bright["lamp_duty_cycle"] > th.lamp_day_duty
    if lit_in_sun.sum() >= th.min_windows:
        c.issues.append(Issue("LAMP_ON_IN_DAYLIGHT", "lamp", "warning",
                              "Lampu menyala saat siang terang. Deteksi gelap pada controller bermasalah "
                              "dan energi baterai terbuang.", float(lit_in_sun.sum())))


def _check_charging(c: _Context, th: Thresholds, base: Baseline) -> None:
    if len(c.bright) < th.min_windows:
        return
    # Battery still on the bus (not floating at panel voltage = not full) yet not charging.
    battery_on_bus = c.bright["bus_voltage_mean"] < BATTERY_MAX_BUS_V + 0.1
    stalled = battery_on_bus & (c.bright["charging_fraction"] < 0.1)
    if stalled.sum() >= th.min_windows:
        c.issues.append(Issue("NO_CHARGING", "panel", "critical",
                              "Cuaca terang dan baterai belum penuh, tetapi baterai tidak terisi. "
                              "Periksa panel, kabel panel, atau controller.", float(stalled.sum())))
        return
    yields = c.bright["solar_yield_when_charging"].dropna()
    if base.yield_when_charging and len(yields) >= th.min_windows:
        ratio = yields.median() / base.yield_when_charging
        if ratio < th.panel_underperform_ratio:
            c.issues.append(Issue("PANEL_UNDERPERFORM", "panel", "warning",
                                  f"Daya panel hanya {ratio:.0%} dari normal untuk intensitas cahaya yang sama. "
                                  "Panel mungkin kotor atau tertutup bayangan.", ratio))


def _lamp_summary(c: _Context) -> dict:
    night = c.night if len(c.night) else c.dark

    def med(col: str) -> float | None:
        values = night[col].dropna()
        return round(float(values.median()), 4) if len(values) else None

    episodes = night["bright_episodes_per_hour"].dropna()
    return {
        "night_duty_cycle": med("lamp_duty_cycle"),
        "on_current_a": med("load_current_when_on"),
        # Motion-sensor activity index: bright-mode episodes per night hour. PWM
        # snapshots can split one passer-by into several episodes, so not a head count.
        "bright_episodes_per_hour": round(float(episodes.mean()), 2) if len(episodes) else None,
    }


def _check_condition_model(c: _Context, th: Thresholds, model: ConditionModel) -> dict:
    """Run the forest on the last 24 h of windows and report its verdict.

    A fault class is *confirmed* when at least ``min_windows`` windows are
    predicted as it with ``ml_min_probability`` or more; only then can it become
    an issue, and only when no rule already flagged the same component.
    Otherwise the verdict of the latest window is reported, unconfirmed.
    """
    proba = model.predict_proba(c.all)
    label = proba.idxmax(axis=1)
    vote = proba.max(axis=1)
    flagged = label[(label != NORMAL) & (vote >= th.ml_min_probability)]
    counts = flagged.value_counts()
    confirmed = bool(len(counts) and counts.iloc[0] >= th.min_windows)
    if confirmed:
        top = str(counts.index[0])
        windows = int(counts.iloc[0])
        probability = float(vote[flagged[flagged == top].index].mean())
    else:
        top = str(label.iloc[-1])
        windows = int((flagged == top).sum())
        probability = float(vote.iloc[-1])

    if confirmed:
        component = COMPONENT[top]
        if not any(i.component == component for i in c.issues):
            c.issues.append(Issue(
                f"ML_{top.upper()}", component, "warning",
                f"Model Random Forest mendeteksi pola {LABEL_ID[top]} pada {windows} jendela 10 menit "
                f"(keyakinan rata-rata {probability:.0%}). Perlu dicek di lapangan.", probability))
    return {
        "label": top,
        "label_id": LABEL_ID[top],
        "probability": round(probability, 3) if probability is not None else None,
        "confirmed": confirmed,
        "windows_flagged": windows,
        "windows_checked": int(len(proba)),
        "model_version": model.version,
    }


def assess(
    telemetry: pd.DataFrame,
    baseline: Baseline | None = None,
    thresholds: Thresholds | None = None,
    battery_spec: BatterySpec | None = None,
    now: pd.Timestamp | None = None,
    condition_model: ConditionModel | None = None,
) -> dict | None:
    """Assess one lamp from canonical telemetry.

    Pass 48-72 h of telemetry: rule checks use the last 24 h, the battery
    model uses everything (it needs a "battery full" moment to know the
    charge level). Returns None when the last 24 h hold no usable data.
    """
    th = thresholds or Thresholds()
    base = baseline or Baseline()
    spec = battery_spec or BatterySpec()
    if telemetry.empty:
        return None
    now = now if now is not None else telemetry[S.TIME].max()
    history = telemetry[telemetry[S.TIME] <= now].drop(columns="segment", errors="ignore")
    recent = history[history[S.TIME] > now - LOOKBACK]
    feats = build_features(recent)
    if feats.empty:
        return None

    status = battery_status(history, spec, now=now)
    c = _context(feats, status)
    _check_sensors(c, th)
    _check_battery(c, th, spec)
    _check_lamp(c, th, base)
    _check_charging(c, th, base)
    condition = _check_condition_model(c, th, condition_model) if condition_model is not None else None

    component_health = {comp: 100 for comp in COMPONENTS}
    for issue in c.issues:
        component_health[issue.component] = max(0, component_health[issue.component] - SEVERITY_PENALTY[issue.severity])
    health = max(0, 100 - sum(SEVERITY_PENALTY[i.severity] for i in c.issues))

    severities = {i.severity for i in c.issues}
    if "critical" in severities or health < 40:
        risk = "high"
    elif "warning" in severities or health < 70:
        risk = "medium"
    else:
        risk = "low"

    covered_hours = float((feats["coverage_ratio"] * WINDOW_S).sum() / 3600)
    # Confidence here = how much of the last 24 h has data, not a model probability.
    confidence = round(min(1.0, covered_hours / (LOOKBACK.total_seconds() / 3600)), 3)

    ordered = sorted(c.issues, key=lambda i: -SEVERITY_PENALTY[i.severity])
    recommendation = " ".join(i.message for i in ordered) or "Kondisi normal, tidak ada tindakan segera."
    days = status.days_to_empty

    battery = status.to_dict()
    rest_v = _rest_voltage(c)
    battery["voltage_v"] = round(rest_v, 3) if rest_v is not None else None

    return {
        "failure_probability": round(1 - health / 100, 3),
        "days_to_failure": int(np.floor(days)) if days is not None else None,
        "risk_level": risk,
        "recommendation": recommendation,
        "model_version": f"{MODEL_VERSION}+{condition_model.version}" if condition_model else MODEL_VERSION,
        "confidence": confidence,
        "health_score": float(health),
        "component_health": component_health,
        "issues": [i.to_dict() for i in ordered],
        "battery": battery,
        "lamp": _lamp_summary(c),
        "condition": condition,
        "assessed_at": pd.Timestamp(now).isoformat(),
        "data_hours": round(covered_hours, 2),
    }


def telemetry_from_records(records: list[dict], units: str = "si") -> pd.DataFrame:
    """Build canonical telemetry from backend rows (dicts with the Telemetry columns).

    ``units="device"`` means currents in mA and powers in mW, as the ESP32
    firmware sends them; they are converted to A and W here.
    """
    if units not in {"si", "device"}:
        raise ValueError("units must be 'si' or 'device'")
    df = pd.DataFrame.from_records(records)
    if df.empty:
        return df
    df[S.TIME] = pd.to_datetime(df[S.TIME], utc=True)
    for col in S.SENSOR_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce").astype(float) if col in df.columns else np.nan
    if units == "device":
        for col in S.CURRENT_COLUMNS + S.POWER_COLUMNS:
            df[col] = df[col] / 1000
    return df.sort_values(S.TIME).reset_index(drop=True)


__all__ = ["Thresholds", "Baseline", "Issue", "assess", "telemetry_from_records", "MODEL_VERSION"]
