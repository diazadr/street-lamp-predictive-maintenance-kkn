"""Bridge between the backend and the ``pju_ml`` library.

``pju_ml`` (vendored in ``backend/pju_ml``, source: the KKN ``pju-ml`` project)
holds everything the model needs: cleaning, 10-minute window features, the
battery model, the rule engine and the Random Forest condition classifier.
This module loads the trained artifacts once per process and turns the
``telemetry`` rows of one lamp into an assessment.

Units: telemetry is stored as the ESP32 sends it, currents in mA and powers in
mW. ``pju_ml`` works in A and W, so rows are converted here.
"""

from __future__ import annotations

import logging
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from pju_ml.battery import BatterySpec
from pju_ml.predictor import Baseline, assess, telemetry_from_records
from pju_ml.training import ConditionModel

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parents[2] / "ml_models"
BASELINE_PATH = MODEL_DIR / "baseline.json"
CONDITION_MODEL_PATH = MODEL_DIR / "condition_rf.joblib"

TELEMETRY_UNITS = "device"      # mA and mW, as sent by the firmware
LOOKBACK_HOURS = 72             # the battery model needs a "battery full" moment in range
# A lamp gets predictions after about an hour of data (one reading every ~14 s).
ML_MIN_TELEMETRY = 260

TELEMETRY_COLUMNS = [
    "time", "solar_voltage", "solar_current", "solar_power",
    "battery_voltage", "battery_current", "voltage", "current", "power",
    "lux", "temperature_ambient",
]


@lru_cache(maxsize=1)
def load_baseline() -> Baseline:
    if BASELINE_PATH.exists():
        return Baseline.load(BASELINE_PATH)
    logger.warning("No %s; lamp-dim and panel checks fall back to defaults", BASELINE_PATH.name)
    return Baseline()


@lru_cache(maxsize=1)
def load_condition_model() -> ConditionModel | None:
    if not CONDITION_MODEL_PATH.exists():
        logger.warning("No %s; running the rule engine without the Random Forest", CONDITION_MODEL_PATH.name)
        return None
    try:
        return ConditionModel.load(CONDITION_MODEL_PATH)
    except Exception as exc:  # a broken model file must not stop predictions
        logger.warning("Could not load %s (%s); running without the Random Forest", CONDITION_MODEL_PATH.name, exc)
        return None


def battery_spec_for(lamp: Any | None) -> BatterySpec:
    """Battery of this lamp: its recorded capacity (Wh) or the product default."""
    capacity_wh = getattr(lamp, "battery_capacity_wh", None) if lamp is not None else None
    return BatterySpec.from_capacity_wh(float(capacity_wh) if capacity_wh else None)


def _record(row: Any) -> dict:
    record = {col: getattr(row, col, None) for col in TELEMETRY_COLUMNS}
    if record["temperature_ambient"] is None:
        # Older firmware/RF code put the DS18B20 (hanging in open air) in temperature_internal.
        record["temperature_ambient"] = getattr(row, "temperature_internal", None)
    return record


def assess_rows(rows: list[Any], lamp: Any | None = None, now: datetime | None = None) -> dict | None:
    """Assess one lamp from its telemetry rows (any order). None when there is no usable data."""
    telemetry = telemetry_from_records([_record(r) for r in rows], units=TELEMETRY_UNITS)
    if telemetry.empty:
        return None
    return assess(
        telemetry,
        baseline=load_baseline(),
        battery_spec=battery_spec_for(lamp),
        now=now,
        condition_model=load_condition_model(),
    )
