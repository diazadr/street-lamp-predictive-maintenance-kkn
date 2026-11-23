"""Random Forest condition classifier trained on fault-injected real telemetry.

The recorded data (22-24 Oct 2026) contains no failures, so a classifier cannot
learn faults from it directly. Labelling real windows with the same thresholds
the model then sees as features would only teach the forest to copy those
thresholds. Instead:

1. every 10-minute window of the real data is a **normal** example;
2. copies of the real data get one **injected fault** each, applied to the
   readings with the physics of the hardware (e.g. a dead LED removes its
   current from the lamp branch *and* from the battery branch), with random
   severity; windows where the fault covers most readings get that label;
3. the model is validated **day by day**: trained on one recording day and
   tested on the other, so neighbouring 14-second readings never sit on both
   sides of the split.

The same windows are also classified by the rule engine's thresholds, so the
two approaches can be compared on identical data.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from pju_ml import schema as S
from pju_ml.battery import BATTERY_MAX_BUS_V, BatterySpec
from pju_ml.cleaning import add_segments
from pju_ml.features import DEFAULT_WINDOW, FEATURE_COLUMNS, build_features

NORMAL = "normal"
FAULTS = ["lamp_off", "lamp_dim", "lamp_on_day", "panel_soiled", "no_charge", "battery_low", "sensor_temp"]
CLASSES = [NORMAL, *FAULTS]
COMPONENT = {
    "lamp_off": "lamp", "lamp_dim": "lamp", "lamp_on_day": "lamp",
    "panel_soiled": "panel", "no_charge": "panel",
    "battery_low": "battery", "sensor_temp": "sensor",
}
LABEL_ID = {
    NORMAL: "normal",
    "lamp_off": "lampu tidak menyala",
    "lamp_dim": "LED meredup",
    "lamp_on_day": "lampu menyala di siang hari",
    "panel_soiled": "panel kotor/terhalang",
    "no_charge": "baterai tidak terisi",
    "battery_low": "baterai lemah",
    "sensor_temp": "sensor suhu bermasalah",
}
# Injected copies per fault: faults visible in few windows get more copies.
DEFAULT_COPIES = {
    "lamp_off": 2, "lamp_dim": 4, "lamp_on_day": 2, "panel_soiled": 8,
    "no_charge": 3, "battery_low": 3, "sensor_temp": 1,
}
MIN_FAULT_SHARE = 0.5   # a window gets the fault label when most of its readings carry it
MISSING = -1.0          # sentinel for NaN features (e.g. panel yield at night)


# --------------------------------------------------------------------------
# Fault injection
# --------------------------------------------------------------------------

def inject_fault(df: pd.DataFrame, fault: str, rng: np.random.Generator) -> tuple[pd.DataFrame, pd.Series, float]:
    """Return a faulty copy of canonical telemetry, the affected readings and the severity."""
    out = df.copy()
    dark = out[S.LUX] < S.NIGHT_LUX
    day = out[S.LUX] > S.DAYLIGHT_LUX
    severity = 1.0

    if fault == "lamp_off":
        mask = dark
        i_load = out[S.LOAD_CURRENT].where(mask, 0.0).fillna(0.0)
        out.loc[mask, [S.LOAD_CURRENT, S.LOAD_POWER]] = 0.0
        out[S.BATTERY_CURRENT] -= i_load          # the battery no longer feeds the LED
    elif fault == "lamp_dim":
        severity = float(rng.uniform(0.2, 0.6))   # remaining share of LED current
        mask = dark
        i_load = out[S.LOAD_CURRENT].where(mask, 0.0).fillna(0.0)
        out.loc[mask, S.LOAD_CURRENT] *= severity
        out.loc[mask, S.LOAD_POWER] *= severity
        out[S.BATTERY_CURRENT] -= i_load * (1 - severity)
    elif fault == "lamp_on_day":
        mask = day
        pwm_on = rng.random(len(out)) < 0.6       # dim-mode duty cycle seen at night
        i_lamp = pd.Series(np.where(pwm_on, 0.14, 0.0), index=out.index).where(mask, 0.0)
        out[S.LOAD_CURRENT] = out[S.LOAD_CURRENT].where(~mask, i_lamp)
        out[S.LOAD_POWER] = out[S.LOAD_POWER].where(~mask, i_lamp * out[S.LOAD_VOLTAGE])
        out[S.SOLAR_CURRENT] += i_lamp            # the panel supplies the lamp
        out[S.SOLAR_POWER] += i_lamp * out[S.SOLAR_VOLTAGE]
    elif fault == "panel_soiled":
        severity = float(rng.uniform(0.2, 0.7))   # remaining share of panel output
        mask = (out[S.BATTERY_CURRENT] < -0.01) & day
        for col in (S.SOLAR_CURRENT, S.SOLAR_POWER, S.BATTERY_CURRENT, S.BATTERY_POWER):
            out.loc[mask, col] *= severity
    elif fault == "no_charge":
        mask = day
        rest_v = float(out.loc[dark, S.BATTERY_VOLTAGE].median()) if dark.any() else 3.27
        noise = rng.normal(0, 0.01, mask.sum())
        for col in (S.SOLAR_VOLTAGE, S.BATTERY_VOLTAGE, S.LOAD_VOLTAGE):
            out.loc[mask, col] = rest_v + noise   # battery stays on the bus, not full
        out.loc[mask, [S.SOLAR_CURRENT, S.SOLAR_POWER, S.BATTERY_POWER]] = 0.0
        out.loc[mask, S.BATTERY_CURRENT] = out.loc[mask, S.LOAD_CURRENT].fillna(0.0)
    elif fault == "battery_low":
        severity = float(rng.uniform(2.6, 3.08))  # bus voltage at night
        mask = dark
        noise = rng.normal(0, 0.01, mask.sum())
        for col in (S.SOLAR_VOLTAGE, S.BATTERY_VOLTAGE, S.LOAD_VOLTAGE):
            out.loc[mask, col] = severity + noise
    elif fault == "sensor_temp":
        mask = pd.Series(True, index=out.index)
        out[S.TEMPERATURE] = -127.0               # DS18B20 "disconnected" code
    else:
        raise ValueError(f"Unknown fault: {fault}")
    return out, mask.astype(bool), severity


def _window_share(df: pd.DataFrame, mask: pd.Series, window: str) -> pd.Series:
    """Share of each window's readings covered by ``mask`` (same grid as build_features)."""
    frame = pd.DataFrame({"segment": df["segment"], S.TIME: df[S.TIME], "m": mask.astype(float)})
    share = frame.groupby(["segment", pd.Grouper(key=S.TIME, freq=window, origin="start_day")])["m"].mean()
    return share.rename("share").reset_index().rename(columns={S.TIME: "window_start"})


# --------------------------------------------------------------------------
# Training set
# --------------------------------------------------------------------------

def make_training_set(
    telemetry: pd.DataFrame,
    copies: dict[str, int] | None = None,
    seed: int = 42,
    window: str = DEFAULT_WINDOW,
) -> pd.DataFrame:
    """Window features with labels: real windows as normal plus injected faults.

    Returns the feature columns plus ``label``, ``severity``, ``segment`` and
    ``window_start``.
    """
    copies = {**DEFAULT_COPIES, **(copies or {})}
    rng = np.random.default_rng(seed)
    base = telemetry.sort_values(S.TIME).reset_index(drop=True)
    if "segment" not in base.columns:
        base = add_segments(base)

    parts = []
    normal = build_features(base, window=window)
    parts.append(normal.assign(label=NORMAL, severity=np.nan))

    for fault in FAULTS:
        for _ in range(copies[fault]):
            faulty, mask, severity = inject_fault(base, fault, rng)
            feats = build_features(faulty, window=window)
            share = _window_share(base, mask, window)
            feats = feats.merge(share, on=["segment", "window_start"], how="left")
            feats = feats[feats["share"] >= MIN_FAULT_SHARE].drop(columns="share")
            parts.append(feats.assign(label=fault, severity=severity))
    return pd.concat(parts, ignore_index=True)


def feature_matrix(features: pd.DataFrame, columns: list[str] | None = None) -> pd.DataFrame:
    return features[columns or FEATURE_COLUMNS].astype(float).fillna(MISSING)


# --------------------------------------------------------------------------
# Rule engine on single windows (for comparison)
# --------------------------------------------------------------------------

def rule_window_labels(features: pd.DataFrame, baseline, spec: BatterySpec | None = None) -> pd.Series:
    """Classify each window with the rule engine's thresholds (one label per window)."""
    from pju_ml.predictor import Thresholds  # local import: predictor imports this module

    th = Thresholds()
    spec = spec or BatterySpec()
    f = features
    dark = f["lux_mean"] < S.NIGHT_LUX
    bright = f["lux_mean"] > S.BRIGHT_LUX
    rules = [  # priority order: the first matching rule names the window
        ("sensor_temp", f["temperature_missing_fraction"] >= 0.5),
        ("battery_low", dark & (f["battery_voltage_rest"] < spec.low_v)),
        ("lamp_off", dark & (f["lamp_duty_cycle"] < th.lamp_off_duty)),
        ("lamp_dim", dark & (f["load_current_when_on"] < th.lamp_dim_ratio * (baseline.night_load_current_on or 0))),
        ("lamp_on_day", bright & (f["lamp_duty_cycle"] > th.lamp_day_duty)),
        ("no_charge", bright & (f["bus_voltage_mean"] < BATTERY_MAX_BUS_V + 0.1) & (f["charging_fraction"] < 0.1)),
        ("panel_soiled", bright & (f["solar_yield_when_charging"]
                                   < th.panel_underperform_ratio * (baseline.yield_when_charging or 0))),
    ]
    labels = pd.Series(NORMAL, index=f.index)
    for name, hit in reversed(rules):
        labels[hit.fillna(False)] = name
    return labels


# --------------------------------------------------------------------------
# Model
# --------------------------------------------------------------------------

def new_forest(seed: int = 42):
    from sklearn.ensemble import RandomForestClassifier

    return RandomForestClassifier(
        n_estimators=300,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=seed,
        n_jobs=-1,
    )


@dataclass
class ConditionModel:
    """Fitted forest plus everything needed to use it safely elsewhere."""

    model: object
    features: list[str]
    classes: list[str]
    version: str
    metrics: dict = field(default_factory=dict)
    sklearn_version: str = ""
    trained_at: str = ""
    training_data: str = ""

    def predict_proba(self, features: pd.DataFrame) -> pd.DataFrame:
        proba = self.model.predict_proba(feature_matrix(features, self.features))
        return pd.DataFrame(proba, columns=list(self.model.classes_), index=features.index)

    def save(self, path: str | Path) -> None:
        import joblib

        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({k: getattr(self, k) for k in self.__dataclass_fields__}, path)

    @classmethod
    def load(cls, path: str | Path) -> "ConditionModel":
        import joblib
        import sklearn

        bundle = joblib.load(path)
        if bundle.get("sklearn_version") and bundle["sklearn_version"] != sklearn.__version__:
            warnings.warn(f"Model trained with scikit-learn {bundle['sklearn_version']}, "
                          f"running {sklearn.__version__}; retrain to be safe.", stacklevel=2)
        return cls(**bundle)


def _scores(y_true: pd.Series, y_pred: pd.Series) -> dict:
    from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_recall_fscore_support

    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=CLASSES, zero_division=0)
    normal_windows = y_true == NORMAL
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "f1_macro": round(float(f1_score(y_true, y_pred, labels=CLASSES, average="macro", zero_division=0)), 4),
        "false_alarm_rate": round(float((y_pred[normal_windows] != NORMAL).mean()), 4) if normal_windows.any() else None,
        "per_class": {
            c: {"precision": round(float(p), 4), "recall": round(float(r), 4), "f1": round(float(f), 4), "support": int(s)}
            for c, p, r, f, s in zip(CLASSES, precision, recall, f1, support)
        },
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=CLASSES).tolist(),
    }


def evaluate_by_day(data: pd.DataFrame, baseline_fn, seed: int = 42) -> dict:
    """Leave-one-recording-day-out evaluation of the forest and of the rules.

    ``baseline_fn(normal_features) -> Baseline`` learns the rule baseline from the
    training day only, so neither method sees the test day.
    """
    days = sorted(data["segment"].unique())
    rf_true, rf_pred, rule_pred = [], [], []
    folds = []
    for test_day in days:
        train = data[data["segment"] != test_day]
        test = data[data["segment"] == test_day]
        forest = new_forest(seed).fit(feature_matrix(train), train["label"])
        predicted = pd.Series(forest.predict(feature_matrix(test)), index=test.index)
        base = baseline_fn(train[train["label"] == NORMAL])
        by_rules = rule_window_labels(test, base)
        folds.append({
            "test_segment": int(test_day),
            "train_windows": int(len(train)),
            "test_windows": int(len(test)),
            "random_forest": _scores(test["label"], predicted),
            "rules": _scores(test["label"], by_rules),
        })
        rf_true.append(test["label"])
        rf_pred.append(predicted)
        rule_pred.append(by_rules)
    y_true = pd.concat(rf_true)
    return {
        "folds": folds,
        "random_forest": _scores(y_true, pd.concat(rf_pred)),
        "rules": _scores(y_true, pd.concat(rule_pred)),
    }


def train_condition_model(data: pd.DataFrame, evaluation: dict | None = None, seed: int = 42,
                          training_data: str = "") -> ConditionModel:
    """Fit the final forest on all labelled windows."""
    import sklearn

    forest = new_forest(seed).fit(feature_matrix(data), data["label"])
    importance = pd.Series(forest.feature_importances_, index=FEATURE_COLUMNS).sort_values(ascending=False)
    now = datetime.now(UTC)
    metrics = {
        "windows": int(len(data)),
        "class_counts": {k: int(v) for k, v in data["label"].value_counts().items()},
        "feature_importance_top10": {k: round(float(v), 4) for k, v in importance.head(10).items()},
    }
    if evaluation:
        metrics["evaluation_leave_one_day_out"] = evaluation
    return ConditionModel(
        model=forest,
        features=list(FEATURE_COLUMNS),
        classes=list(forest.classes_),
        version=f"rf-condition-{now:%Y%m%d}",
        metrics=metrics,
        sklearn_version=sklearn.__version__,
        trained_at=now.isoformat(),
        training_data=training_data,
    )


def model_card(model: ConditionModel) -> dict:
    """Human-readable description of a trained model: data, method, evaluation, limits."""
    return {
        "model": model.version,
        "type": "RandomForestClassifier (300 trees, min_samples_leaf=2, class_weight=balanced)",
        "sklearn_version": model.sklearn_version,
        "trained_at": model.trained_at,
        "training_data": model.training_data,
        "window": DEFAULT_WINDOW,
        "classes": {c: LABEL_ID[c] for c in CLASSES},
        "method": (
            "Real windows are 'normal'. Copies of the real data each get one injected fault, "
            "applied with the hardware's physics and random severity; windows where the fault "
            "covers at least half the readings take its label. Validation trains on one recording "
            "day and tests on the other; the rule engine is scored on the same windows."
        ),
        "injected_copies": DEFAULT_COPIES,
        "metrics": model.metrics,
        "limitations": [
            "Only two recording days from one unit; faults are simulated, not observed.",
            "Mild panel soiling is hard to tell from cloudy weather with so few charging windows.",
            "Retrain when longer data and real repair tickets (repair_tickets) are available.",
        ],
    }


__all__ = [
    "CLASSES", "FAULTS", "NORMAL", "COMPONENT", "LABEL_ID", "inject_fault", "make_training_set",
    "feature_matrix", "rule_window_labels", "evaluate_by_day", "train_condition_model", "ConditionModel",
    "model_card",
]
