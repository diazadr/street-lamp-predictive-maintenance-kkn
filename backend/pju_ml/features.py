"""Window-level features from canonical telemetry.

The same code runs at training time and inside the backend, so a model
never sees features computed two different ways.

Input: canonical telemetry (see ``pju_ml.schema``), SI units, a timezone-aware
``time`` column, optionally a ``segment`` column (continuous recording runs).
Output: one row per (segment, window).

Hardware facts behind the features (hardware team, 23 Nov 2026, and the data):

* The LED board is PWM-dimmed. Each INA219 reading is a ~0.5 ms snapshot, so
  at night a reading shows either the on-phase current (~140 mA in dim mode)
  or ~0. The share of "on" readings estimates the PWM duty cycle and the mean
  of all readings the average current. Zero readings and on/off "toggles"
  between readings are therefore not faults.
* A motion sensor switches the lamp to bright mode (250-700 mA) for a few
  seconds when someone passes: busy in the evening, none after ~23:00.
* The three INA219 share one bus voltage. ``battery_voltage_rest`` keeps only
  readings where that bus is the battery (see ``pju_ml.battery``).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from pju_ml import schema as S
from pju_ml.battery import BATTERY, CHARGING, FULL, classify_bus
from pju_ml.cleaning import add_segments, sample_durations, sanitize

DEFAULT_WINDOW = "10min"

LAMP_ON_CURRENT_A = 0.020    # reading above this = LED in its PWM on-phase
BRIGHT_CURRENT_A = 0.250     # reading above this = motion-triggered bright mode
MAX_SAMPLE_DT_S = 60.0       # a reading never stands for more than this many seconds

FEATURE_COLUMNS = [
    "coverage_ratio",
    # generation
    "solar_power_mean", "solar_power_max", "solar_current_mean", "solar_energy_wh",
    "solar_yield_w_per_klux", "solar_yield_when_charging",
    # battery / shared bus
    "bus_voltage_mean", "bus_voltage_max", "battery_voltage_rest",
    "battery_current_mean", "battery_net_ah", "charging_fraction", "battery_full_fraction",
    # lamp
    "load_power_mean", "load_current_mean", "load_current_when_on", "load_energy_wh",
    "lamp_duty_cycle", "lamp_toggles_per_hour", "bright_fraction", "bright_episodes_per_hour",
    # environment
    "lux_mean", "lux_max", "daylight_fraction", "temperature_mean", "temperature_max",
    # data quality / wiring consistency
    "temperature_missing_fraction", "sensor_missing_fraction",
    "voltage_spread_mean", "current_balance_residual_mean",
    # time of day
    "hour_sin", "hour_cos",
]


def _flag(condition: pd.Series, valid: pd.Series) -> pd.Series:
    """1.0 / 0.0 where ``valid``, NaN elsewhere."""
    return condition.astype(float).where(valid)


def _per_sample(df: pd.DataFrame) -> pd.DataFrame:
    """Add per-reading helper columns used by the window aggregation."""
    df = df.copy()
    df["_dt_s"] = sample_durations(df, MAX_SAMPLE_DT_S)

    load_known = df[S.LOAD_CURRENT].notna()
    df["_lamp_on"] = _flag(df[S.LOAD_CURRENT] > LAMP_ON_CURRENT_A, load_known)
    prev_on = df.groupby("segment")["_lamp_on"].shift(1)
    df["_lamp_toggle"] = ((df["_lamp_on"] != prev_on) & prev_on.notna() & df["_lamp_on"].notna()).astype(float)
    df["_bright"] = _flag(df[S.LOAD_CURRENT] > BRIGHT_CURRENT_A, load_known)
    prev_bright = df.groupby("segment")["_bright"].shift(1)
    df["_bright_start"] = ((df["_bright"] == 1) & (prev_bright == 0)).astype(float)
    df["_load_i_on"] = df[S.LOAD_CURRENT].where(df["_lamp_on"] == 1)

    state = classify_bus(df)
    known = state.notna()
    df["_charging"] = _flag(state == CHARGING, known)
    df["_full"] = _flag(state == FULL, known)
    df["_v_rest"] = df[S.BATTERY_VOLTAGE].where(state == BATTERY)

    df["_daylight"] = _flag(df[S.LUX] > S.DAYLIGHT_LUX, df[S.LUX].notna())

    df["_solar_wh"] = df[S.SOLAR_POWER] * df["_dt_s"] / 3600
    df["_load_wh"] = df[S.LOAD_POWER] * df["_dt_s"] / 3600
    # positive = charge flowing into the battery (device reports charging as negative)
    df["_batt_ah_in"] = -df[S.BATTERY_CURRENT] * df["_dt_s"] / 3600

    # Panel output per klux only means something while the battery accepts charge:
    # once it is full the controller stops charging even in bright sun.
    bright_and_charging = (df["_charging"] == 1) & (df[S.LUX] > S.DAYLIGHT_LUX)
    df["_yield_charging"] = (df[S.SOLAR_POWER] / (df[S.LUX] / 1000)).where(bright_and_charging)

    volts = df[[S.SOLAR_VOLTAGE, S.BATTERY_VOLTAGE, S.LOAD_VOLTAGE]]
    df["_v_spread"] = volts.max(axis=1, skipna=False) - volts.min(axis=1, skipna=False)
    # Kirchhoff at the shared node: solar in + battery out = load. A large residual
    # means a wiring or sensor problem (PWM snapshots add some noise at night).
    df["_i_residual"] = (df[S.SOLAR_CURRENT] + df[S.BATTERY_CURRENT] - df[S.LOAD_CURRENT]).abs()

    core = [S.SOLAR_VOLTAGE, S.SOLAR_CURRENT, S.BATTERY_VOLTAGE, S.BATTERY_CURRENT,
            S.LOAD_VOLTAGE, S.LOAD_CURRENT, S.LUX, S.TEMPERATURE]
    df["_missing"] = df[core].isna().mean(axis=1)
    df["_temp_missing"] = df[S.TEMPERATURE].isna().astype(float)
    return df


def build_features(
    telemetry: pd.DataFrame,
    window: str = DEFAULT_WINDOW,
    min_samples: int = 5,
    origin: str | pd.Timestamp = "start_day",
) -> pd.DataFrame:
    """Aggregate telemetry into fixed windows.

    Windows with fewer than ``min_samples`` readings are dropped. ``origin`` is
    passed to ``pd.Grouper`` and sets where the window grid starts.
    """
    df, _ = sanitize(telemetry)
    if "segment" not in df.columns:
        df = add_segments(df.sort_values(S.TIME).reset_index(drop=True))
    if df.empty:
        return pd.DataFrame(columns=["segment", "window_start", "n_samples", *FEATURE_COLUMNS])

    df = _per_sample(df)
    window_s = pd.Timedelta(window).total_seconds()

    grouped = df.groupby(["segment", pd.Grouper(key=S.TIME, freq=window, origin=origin)])
    f = grouped.agg(
        n_samples=(S.TIME, "size"),
        _dt_sum=("_dt_s", "sum"),
        solar_power_mean=(S.SOLAR_POWER, "mean"),
        solar_power_max=(S.SOLAR_POWER, "max"),
        solar_current_mean=(S.SOLAR_CURRENT, "mean"),
        solar_energy_wh=("_solar_wh", "sum"),
        solar_yield_when_charging=("_yield_charging", "mean"),
        bus_voltage_mean=(S.BATTERY_VOLTAGE, "mean"),
        bus_voltage_max=(S.BATTERY_VOLTAGE, "max"),
        battery_voltage_rest=("_v_rest", "mean"),
        battery_current_mean=(S.BATTERY_CURRENT, "mean"),
        battery_net_ah=("_batt_ah_in", "sum"),
        charging_fraction=("_charging", "mean"),
        battery_full_fraction=("_full", "mean"),
        load_power_mean=(S.LOAD_POWER, "mean"),
        load_current_mean=(S.LOAD_CURRENT, "mean"),
        load_current_when_on=("_load_i_on", "median"),
        load_energy_wh=("_load_wh", "sum"),
        lamp_duty_cycle=("_lamp_on", "mean"),
        _toggles=("_lamp_toggle", "sum"),
        bright_fraction=("_bright", "mean"),
        _motion=("_bright_start", "sum"),
        lux_mean=(S.LUX, "mean"),
        lux_max=(S.LUX, "max"),
        daylight_fraction=("_daylight", "mean"),
        temperature_mean=(S.TEMPERATURE, "mean"),
        temperature_max=(S.TEMPERATURE, "max"),
        temperature_missing_fraction=("_temp_missing", "mean"),
        sensor_missing_fraction=("_missing", "mean"),
        voltage_spread_mean=("_v_spread", "mean"),
        current_balance_residual_mean=("_i_residual", "mean"),
    )
    f = f[f["n_samples"] >= min_samples].reset_index().rename(columns={S.TIME: "window_start"})

    f["coverage_ratio"] = (f.pop("_dt_sum") / window_s).clip(upper=1.0)
    hours_covered = (f["coverage_ratio"] * window_s / 3600).replace(0, np.nan)
    f["lamp_toggles_per_hour"] = f.pop("_toggles") / hours_covered
    f["bright_episodes_per_hour"] = f.pop("_motion") / hours_covered
    daylight = f["lux_mean"] > S.DAYLIGHT_LUX
    f["solar_yield_w_per_klux"] = (f["solar_power_mean"] / (f["lux_mean"] / 1000)).where(daylight)

    local = f["window_start"].dt.tz_convert(S.LOCAL_TZ) if f["window_start"].dt.tz is not None else f["window_start"]
    hour = local.dt.hour + local.dt.minute / 60
    f["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    f["hour_cos"] = np.cos(2 * np.pi * hour / 24)

    return f[["segment", "window_start", "n_samples", *FEATURE_COLUMNS]]


def latest_window_features(telemetry: pd.DataFrame, window: str = DEFAULT_WINDOW) -> pd.Series | None:
    """Features for the most recent ``window`` of telemetry (for live inference)."""
    if telemetry.empty:
        return None
    end = telemetry[S.TIME].max()
    recent = telemetry[telemetry[S.TIME] > end - pd.Timedelta(window)].drop(columns="segment", errors="ignore")
    # Start the grid at the first recent reading so the whole slice is one window.
    feats = build_features(recent, window=window, min_samples=1, origin=recent[S.TIME].min())
    if feats.empty:
        return None
    return feats.iloc[-1]


__all__ = ["FEATURE_COLUMNS", "DEFAULT_WINDOW", "build_features", "latest_window_features"]
