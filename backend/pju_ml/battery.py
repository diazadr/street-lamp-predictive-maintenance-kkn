"""Battery state for the lamp's integrated LiFePO4 pack.

Wiring (hardware team, 23 Nov 2026): the three INA219 sit on the positive
branches of one shared node that splits to the panel, the battery and the LED.
All three therefore read the same node voltage, so the telemetry's
``battery_voltage`` is really the *bus* voltage:

* battery connected (night, or while charging): bus = battery terminal voltage.
  While charging it reads high by the I*R drop of shunts and wiring (up to
  ~4.1 V at 1.8 A in the data);
* battery full: the lamp's built-in controller stops charging and the bus
  floats up to the panel voltage (~7.2 V in sun). That is not the battery;
* dusk and dawn: with no battery current the bus can sit at the panel voltage
  between those two.

So the battery voltage is only read in the BATTERY state, and the state of
charge comes from counting charge in and out (coulomb counting), reset to
100 % each time the controller declares the battery full. LiFePO4 voltage is
flat between ~20 % and ~90 %, so voltage alone cannot give the charge level.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from pju_ml import schema as S
from pju_ml.cleaning import add_segments, sample_durations

CHARGING, BATTERY, FULL, PANEL = "charging", "battery", "full", "panel"

CURRENT_EPS_A = 0.010    # battery current below this magnitude counts as none
BATTERY_MAX_BUS_V = 3.70  # a resting LiFePO4 cell never sits above ~3.65 V
FULL_BUS_V = 5.0          # bus this high with no battery current = charging stopped
MIN_NIGHT_HOURS = 8.0     # a night counts for consumption only with this much dark data
SOC_RESET_GAP = pd.Timedelta(minutes=30)  # charge flow during a longer gap is unknown
MIN_OBSERVED_SHARE = 0.8  # "hours since full" needs this much of that time on record


@dataclass(frozen=True)
class BatterySpec:
    """Pack data. Defaults: the product listing (team decision, 23 Nov 2026)."""

    chemistry: str = S.PRODUCT["battery_chemistry"]
    nominal_v: float = S.PRODUCT["battery_nominal_v"]
    # Product listing: 5000 mAh. (The hardware team first read 2 x 6 Ah on the cells;
    # the team chose the listing.) This number drives SoC, autonomy and days-to-empty.
    capacity_ah: float = S.PRODUCT["battery_capacity_ah"]
    # Share of capacity treated as usable: margin for ageing, the controller's
    # cut-off and optimistic cell labels.
    usable_fraction: float = 0.8
    low_v: float = 3.10       # under light load, below ~3.1 V a LiFePO4 cell is nearly empty
    critical_v: float = 2.90  # near cut-off; the controller will soon switch the lamp off

    @property
    def reserve_pct(self) -> float:
        return (1 - self.usable_fraction) * 100

    @classmethod
    def from_capacity_wh(cls, capacity_wh: float | None) -> "BatterySpec":
        """Spec for a lamp whose record stores capacity in Wh (backend ``lamps`` table)."""
        if not capacity_wh or capacity_wh <= 0:
            return cls()
        return cls(capacity_ah=float(capacity_wh) / cls.nominal_v)


@dataclass
class BatteryStatus:
    soc_pct: float | None              # estimated state of charge now
    hours_since_full: float | None      # since the controller last reported "full"
    nightly_consumption_ah: float | None
    autonomy_nights: float | None       # nights the lamp can run with no sun at all
    days_to_empty: float | None         # only when the pack is no longer filling up daily
    capacity_ah: float
    last_full_at: str | None = None
    observed_hours: float = 0.0         # hours of telemetry the status is based on

    def to_dict(self) -> dict:
        return {k: (round(v, 2) if isinstance(v, float) else v) for k, v in asdict(self).items()}


def classify_bus(df: pd.DataFrame) -> pd.Series:
    """What the shared bus voltage represents at each reading."""
    v = df[S.BATTERY_VOLTAGE]
    i = df[S.BATTERY_CURRENT]
    state = np.select(
        [i < -CURRENT_EPS_A, (i.abs() < CURRENT_EPS_A) & (v > FULL_BUS_V), v <= BATTERY_MAX_BUS_V],
        [CHARGING, FULL, BATTERY],
        default=PANEL,
    )
    return pd.Series(state, index=df.index).where(v.notna() & i.notna())


def estimate_soc(df: pd.DataFrame, spec: BatterySpec = BatterySpec()) -> pd.Series:
    """State of charge (%) per reading by coulomb counting.

    Unknown (NaN) until a "battery full" reading pins it to 100 %, and again
    after any recording gap longer than ``SOC_RESET_GAP`` (the charge that
    flowed during the gap is unknown). ``df`` must be sorted by time.
    """
    if "segment" not in df.columns:
        df = add_segments(df)
    state = classify_bus(df).to_numpy()
    dt_s = sample_durations(df).to_numpy()
    charge_in_ah = (-df[S.BATTERY_CURRENT].fillna(0.0) * dt_s / 3600).to_numpy()
    step_pct = charge_in_ah / spec.capacity_ah * 100
    after_gap = (df[S.TIME].diff() > SOC_RESET_GAP).to_numpy()

    soc = np.full(len(df), np.nan)
    level = np.nan
    for k in range(len(df)):
        if after_gap[k]:
            level = np.nan
        if state[k] == FULL:
            level = 100.0
        elif not np.isnan(level):
            level = min(100.0, max(0.0, level + step_pct[k]))
        soc[k] = level
    return pd.Series(soc, index=df.index)


def nightly_consumption(df: pd.DataFrame) -> pd.Series:
    """Ah drawn from the battery per finished night with enough dark data.

    A night counts once daylight readings follow it (a night still in progress
    would understate consumption). Indexed by the evening date, local time.
    """
    if "segment" not in df.columns:
        df = add_segments(df)
    dt_s = sample_durations(df)
    dark = df[S.LUX] < S.NIGHT_LUX
    discharge_ah = df[S.BATTERY_CURRENT].clip(lower=0).fillna(0.0) * dt_s / 3600
    local = df[S.TIME].dt.tz_convert(S.LOCAL_TZ) if df[S.TIME].dt.tz is not None else df[S.TIME]
    night_of = (local - pd.Timedelta(hours=12)).dt.date
    per_night = pd.DataFrame({
        "night": night_of[dark],
        "ah": discharge_ah[dark],
        "hours": dt_s[dark] / 3600,
        "last_dark": df.loc[dark, S.TIME],
    }).groupby("night").agg(ah=("ah", "sum"), hours=("hours", "sum"), last_dark=("last_dark", "max"))
    daylight_times = df.loc[df[S.LUX] > S.DAYLIGHT_LUX, S.TIME]
    if daylight_times.empty:
        return per_night["ah"].iloc[0:0]
    finished = per_night["last_dark"] < daylight_times.max()
    return per_night.loc[(per_night["hours"] >= MIN_NIGHT_HOURS) & finished, "ah"]


def battery_status(df: pd.DataFrame, spec: BatterySpec = BatterySpec(),
                   now: pd.Timestamp | None = None) -> BatteryStatus:
    """Charge level, autonomy and (when the pack is draining) days until empty.

    Pass at least 48-72 h of telemetry: the charge level is only known after a
    "battery full" moment, which normally happens once per sunny morning.
    """
    df = df.sort_values(S.TIME).reset_index(drop=True)
    if now is not None:
        df = df[df[S.TIME] <= now].reset_index(drop=True)
    if df.empty:
        return BatteryStatus(None, None, None, None, None, spec.capacity_ah)
    df = add_segments(df.drop(columns="segment", errors="ignore"))
    now = now if now is not None else df[S.TIME].max()
    dt_s = sample_durations(df)

    soc_series = estimate_soc(df, spec)
    soc = None if np.isnan(soc_series.iloc[-1]) else float(soc_series.iloc[-1])

    full_times = df.loc[classify_bus(df) == FULL, S.TIME]
    last_full = full_times.max() if len(full_times) else None
    hours_since_full = None
    if last_full is not None:
        elapsed_s = (now - last_full).total_seconds()
        observed_s = dt_s[df[S.TIME] > last_full].sum()
        # Only claim "not full for N hours" when those hours are actually on record
        # (within the first hour a missing reading or two is not a gap worth refusing).
        if elapsed_s <= 3600 or observed_s / elapsed_s >= MIN_OBSERVED_SHARE:
            hours_since_full = elapsed_s / 3600

    nights = nightly_consumption(df)
    per_night = float(nights.median()) if len(nights) else None

    autonomy = None
    if soc is not None and per_night:
        usable_ah = max(0.0, soc - spec.reserve_pct) / 100 * spec.capacity_ah
        autonomy = usable_ah / per_night

    # Days to empty only makes sense once the pack has stopped filling up every day:
    # then the drop since the last "full" is a net drain rate.
    days_to_empty = None
    if soc is not None and hours_since_full is not None and hours_since_full >= 30:
        drain_per_day = (100.0 - soc) / (hours_since_full / 24)
        if drain_per_day > 0:
            days_to_empty = max(0.0, soc - spec.reserve_pct) / drain_per_day

    return BatteryStatus(
        soc_pct=soc,
        hours_since_full=hours_since_full,
        nightly_consumption_ah=per_night,
        autonomy_nights=autonomy,
        days_to_empty=days_to_empty,
        capacity_ah=spec.capacity_ah,
        last_full_at=last_full.isoformat() if last_full is not None else None,
        observed_hours=float(dt_s.sum() / 3600),
    )


__all__ = [
    "BatterySpec", "BatteryStatus", "classify_bus", "estimate_soc", "nightly_consumption",
    "battery_status", "CHARGING", "BATTERY", "FULL", "PANEL",
]
