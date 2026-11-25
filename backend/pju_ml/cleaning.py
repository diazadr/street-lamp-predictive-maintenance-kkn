"""Turn the raw logger export into clean telemetry in the canonical schema.

Two layers:

* ``sanitize`` works on canonical telemetry (SI units, backend column names).
  The backend can call it on rows read from its own ``telemetry`` table.
* ``clean_raw`` / ``clean_file`` handle quirks of the logger exports
  (Excel turned decimals into dates, values stored as text, rows that were
  filled in by hand or by a script) and end by calling ``sanitize``.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from pju_ml import schema as S

# A gap longer than this starts a new recording segment.
SEGMENT_GAP = pd.Timedelta(minutes=10)


@dataclass
class CleaningReport:
    rows_in: int = 0
    rows_out: int = 0
    excel_date_repaired: dict[str, int] = field(default_factory=dict)
    unparseable: dict[str, int] = field(default_factory=dict)
    sensor_error_codes: dict[str, int] = field(default_factory=dict)
    out_of_range: dict[str, int] = field(default_factory=dict)
    duplicate_timestamps: int = 0
    suspect_synthetic_rows: int = 0
    missing_after_cleaning: dict[str, int] = field(default_factory=dict)
    median_sample_interval_s: float | None = None
    segments: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return self.__dict__.copy()


# --------------------------------------------------------------------------
# Excel-specific repair
# --------------------------------------------------------------------------

def repair_excel_date(value):
    """Undo Excel reading a decimal like ``"7.12"`` as the date 7 December.

    The logger writes two decimals and Excel (Indonesian locale) parsed
    ``D.MM`` as day.month, so the original number is ``day + month / 100``.
    This was checked against the uncorrupted power columns (P = V * I).
    """
    if isinstance(value, (dt.datetime, dt.date, pd.Timestamp)):
        return value.day + value.month / 100
    return value


def _to_float(series: pd.Series) -> tuple[pd.Series, int]:
    out = pd.to_numeric(series, errors="coerce")
    bad = int((out.isna() & series.notna() & (series.astype(str).str.strip() != "")).sum())
    return out.astype(float), bad


def clean_raw(raw: pd.DataFrame, drop_synthetic: bool = True) -> tuple[pd.DataFrame, CleaningReport]:
    """Clean a raw logger DataFrame (columns like ``V1_Solar``, ``I1_Solar``...).

    With ``drop_synthetic`` rows that cannot have come from the sensors
    (see ``flag_synthetic``) are removed, so filled-in gaps stay gaps.
    """
    report = CleaningReport(rows_in=len(raw))

    missing = [c for c in [S.RAW_TIME_COLUMN, *S.RAW_COLUMN_MAP] if c not in raw.columns]
    if missing:
        raise ValueError(f"Raw data is missing columns: {missing}")

    out = pd.DataFrame()
    out[S.TIME] = pd.to_datetime(raw[S.RAW_TIME_COLUMN], errors="coerce")

    for raw_col, (col, factor) in S.RAW_COLUMN_MAP.items():
        series = raw[raw_col]
        is_date = series.map(lambda v: isinstance(v, (dt.datetime, dt.date, pd.Timestamp)))
        report.excel_date_repaired[col] = int(is_date.sum())
        values, bad = _to_float(series.map(repair_excel_date))
        report.unparseable[col] = bad
        out[col] = values * factor

    out = out.dropna(subset=[S.TIME])
    if out[S.TIME].dt.tz is None:
        out[S.TIME] = out[S.TIME].dt.tz_localize(S.LOCAL_TZ)

    out = out.sort_values(S.TIME)
    dupes = out[S.TIME].duplicated(keep="first")
    report.duplicate_timestamps = int(dupes.sum())
    out = out[~dupes].reset_index(drop=True)

    synthetic = flag_synthetic(out)
    report.suspect_synthetic_rows = int(synthetic.sum())
    if drop_synthetic:
        out = out[~synthetic].reset_index(drop=True)

    out, sanitize_report = sanitize(out)
    report.sensor_error_codes = sanitize_report["sensor_error_codes"]
    report.out_of_range = sanitize_report["out_of_range"]

    out = add_segments(out)
    report.rows_out = len(out)
    report.missing_after_cleaning = {c: int(out[c].isna().sum()) for c in S.SENSOR_COLUMNS}
    if len(out) > 1:
        report.median_sample_interval_s = float(out[S.TIME].diff().dt.total_seconds().median())
    report.segments = summarize_segments(out)
    return out, report


def load_raw_excel(path: str | Path) -> pd.DataFrame:
    """Read the logger export without letting pandas guess types."""
    raw = pd.read_excel(path, dtype=object)
    return raw.loc[:, ~raw.columns.astype(str).str.startswith("Unnamed")]


def load_raw_csv(path: str | Path) -> pd.DataFrame:
    """Read a CSV export. Timestamps are day-first (``22/10/2026 8:04:55``)."""
    raw = pd.read_csv(path, dtype=str)
    raw = raw.loc[:, ~raw.columns.astype(str).str.startswith("Unnamed")]
    stamps = raw[S.RAW_TIME_COLUMN].str.strip()
    parsed = pd.to_datetime(stamps, format="%d/%m/%Y %H:%M:%S", errors="coerce")
    # Fall back to a day-first guess for rows in another layout (e.g. with milliseconds).
    fallback = pd.to_datetime(stamps[parsed.isna()], dayfirst=True, errors="coerce")
    raw[S.RAW_TIME_COLUMN] = parsed.fillna(fallback)
    return raw


def clean_excel(path: str | Path, drop_synthetic: bool = True) -> tuple[pd.DataFrame, CleaningReport]:
    return clean_raw(load_raw_excel(path), drop_synthetic=drop_synthetic)


def clean_file(path: str | Path, drop_synthetic: bool = True) -> tuple[pd.DataFrame, CleaningReport]:
    """Clean an ``.xlsx`` or ``.csv`` logger export."""
    path = Path(path)
    if path.suffix.lower() in {".xlsx", ".xls"}:
        raw = load_raw_excel(path)
    elif path.suffix.lower() == ".csv":
        raw = load_raw_csv(path)
    else:
        raise ValueError(f"Unsupported file type: {path.suffix}")
    return clean_raw(raw, drop_synthetic=drop_synthetic)


def flag_synthetic(df: pd.DataFrame) -> pd.Series:
    """Mark rows whose values could not have been produced by the sensors.

    Every real reading carries the sensors' resolution:

    * BH1750 reports raw counts / 1.2, so ``lux * 1.2`` is a whole number;
    * DS18B20 (12-bit) steps in 1/16 degC, so ``temperature * 16`` is whole
      (within the two-decimal rounding of the logger);
    * INA219 (0.1 mA current LSB) computes power in 2 mW steps, from the same
      conversion as V and I, so P is close to V * I.

    Interpolated or generated rows break several of these at once. A row is
    flagged when at least two checks fail, or when one fails and it touches a
    flagged row (the edges of a filled-in run copy real neighbours and slip
    past one or more checks). On the measured data of 22-24 Oct 2026 this
    flags no row; on the ``_lengkap`` CSV it flags exactly the 271 rows that
    fill the 05:43-06:47 gap of 23 Oct.
    """
    def off_grid(values: pd.Series, scale: float, tol: float) -> pd.Series:
        scaled = values * scale
        return (scaled - scaled.round()).abs() > tol  # NaN compares as False

    fails = pd.DataFrame(index=df.index)
    if S.LUX in df.columns:
        fails["lux"] = off_grid(df[S.LUX], 1.2, 0.007)
    if S.TEMPERATURE in df.columns:
        fails["temperature"] = off_grid(df[S.TEMPERATURE], 16, 0.081)
    for col in (S.SOLAR_POWER, S.BATTERY_POWER, S.LOAD_POWER):
        if col in df.columns:
            fails[col] = off_grid(df[col], 1000 / 2, 1e-3)  # W -> mW, in 2 mW steps
    if {S.SOLAR_VOLTAGE, S.SOLAR_CURRENT, S.SOLAR_POWER} <= set(df.columns):
        v, i, p = df[S.SOLAR_VOLTAGE], df[S.SOLAR_CURRENT], df[S.SOLAR_POWER]
        fails["solar_power_vs_vi"] = (i > 0.02) & ((v * i - p).abs() > 0.02 * p + 0.004)

    n_fails = fails.sum(axis=1)
    flagged = n_fails >= 2
    doubtful = n_fails >= 1
    while True:  # grow flagged runs over adjacent doubtful rows
        touching = flagged.shift(1, fill_value=False) | flagged.shift(-1, fill_value=False)
        grown = flagged | (doubtful & touching)
        if grown.equals(flagged):
            return flagged
        flagged = grown


# --------------------------------------------------------------------------
# Canonical-schema helpers (usable by the backend)
# --------------------------------------------------------------------------

def sanitize(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Replace sensor error codes and physically impossible values with NaN."""
    df = df.copy()
    report = {"sensor_error_codes": {}, "out_of_range": {}}

    if S.TEMPERATURE in df.columns:
        temp = pd.to_numeric(df[S.TEMPERATURE], errors="coerce")
        err = temp.isin(S.DS18B20_ERROR_VALUES)
        report["sensor_error_codes"][S.TEMPERATURE] = int(err.sum())
        df[S.TEMPERATURE] = temp.mask(err)

    for col, (lo, hi) in S.VALID_RANGES.items():
        if col not in df.columns:
            continue
        values = pd.to_numeric(df[col], errors="coerce").astype(float)
        bad = values.notna() & ((values < lo) | (values > hi))
        report["out_of_range"][col] = int(bad.sum())
        df[col] = values.mask(bad)

    return df, report


def sample_durations(df: pd.DataFrame, max_dt_s: float = 60.0) -> pd.Series:
    """Seconds each reading stands for: time to the next reading, capped at ``max_dt_s``.

    The cap stops a recording gap from being counted as hours of current flow.
    """
    nxt = df.groupby("segment")[S.TIME].shift(-1) if "segment" in df.columns else df[S.TIME].shift(-1)
    dt_s = (nxt - df[S.TIME]).dt.total_seconds()
    fallback = float(dt_s.median()) if dt_s.notna().any() else 0.0
    return dt_s.fillna(fallback).clip(0, max_dt_s)


def add_segments(df: pd.DataFrame, gap: pd.Timedelta = SEGMENT_GAP) -> pd.DataFrame:
    """Number continuous recording runs; a new segment starts after ``gap``."""
    df = df.copy()
    new_segment = df[S.TIME].diff() > gap
    df["segment"] = new_segment.cumsum().astype(int)
    return df


def summarize_segments(df: pd.DataFrame) -> list[dict]:
    rows = []
    for seg, g in df.groupby("segment"):
        rows.append({
            "segment": int(seg),
            "start": g[S.TIME].min().isoformat(),
            "end": g[S.TIME].max().isoformat(),
            "rows": int(len(g)),
            "hours": round((g[S.TIME].max() - g[S.TIME].min()).total_seconds() / 3600, 2),
        })
    return rows


def drop_short_segments(df: pd.DataFrame, min_rows: int = 60) -> pd.DataFrame:
    """Drop recording runs too short to describe a day/night cycle."""
    sizes = df.groupby("segment")[S.TIME].transform("size")
    return df[sizes >= min_rows].reset_index(drop=True)


def describe_gaps(df: pd.DataFrame, min_gap: pd.Timedelta = pd.Timedelta(minutes=2)) -> pd.DataFrame:
    gaps = df[S.TIME].diff()
    mask = gaps > min_gap
    return pd.DataFrame({
        "gap_start": df[S.TIME].shift(1)[mask],
        "gap_end": df[S.TIME][mask],
        "gap_minutes": (gaps[mask].dt.total_seconds() / 60).round(1),
    }).reset_index(drop=True)


__all__ = [
    "CleaningReport", "repair_excel_date", "clean_raw", "clean_excel", "clean_file",
    "load_raw_excel", "load_raw_csv", "flag_synthetic", "sanitize", "sample_durations",
    "add_segments", "summarize_segments", "drop_short_segments", "describe_gaps",
]
