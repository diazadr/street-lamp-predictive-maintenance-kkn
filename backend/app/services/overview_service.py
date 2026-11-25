"""Telemetry per hour, energy, and the dashboard home page in one request.

The hourly helpers (``hourly_buckets``, ``hourly_window``, ``energy_wh``) also feed
the energy page, the monitoring trend and the public landing page, so every page
reports the same watts and watt-hours.

- ``hourly``: the last 24 h of the fleet per hour (solar power, lamp power, bus
  voltage, light, temperature), anchored at the newest reading so imported or
  paused data still shows a full day.
- ``energy``: solar energy harvested and lamp energy used in that window.
- ``lamps``: every lamp with its latest pju_ml assessment, most urgent first.
- ``conditions``: lamps per Random Forest verdict; ``model``: the model card.

Telemetry keeps the units the ESP32 sends (power in mW, see app/ml/engine.py);
everything here is converted to W and Wh.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import and_, case, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.engine import MODEL_DIR, TELEMETRY_UNITS
from app.models import Lamp, Place, Prediction, Telemetry

WINDOW_HOURS = 24
# Typical gap between two readings of the data logger; only used for an hour with a single reading.
SAMPLE_INTERVAL_S = 14
POWER_SCALE = 0.001 if TELEMETRY_UNITS == "device" else 1.0  # mW -> W
# DS18B20 reports -127 when it loses the sensor; anything outside its range is not a temperature.
TEMP_RANGE_C = (-40.0, 85.0)
MODEL_CARD_PATH = MODEL_DIR / "model_card.json"

STATUS_ORDER = {"fault": 0, "warning": 1, "offline": 2, "maintenance": 3, "online": 4}
SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}


def _num(value: Any) -> float | None:
    return None if value is None else float(value)


def _round(value: float | None, digits: int = 2) -> float | None:
    return None if value is None else round(value, digits)


def window_bounds(last_data_at: datetime | None, hours: int = WINDOW_HOURS) -> tuple[datetime, datetime]:
    """Whole-hour window of ``hours`` that ends with the hour of the newest reading."""
    anchor = last_data_at or datetime.now(UTC)
    end = anchor.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    return end - timedelta(hours=hours), end


def bucket_duration_h(count: int, first: datetime | None, last: datetime | None) -> float:
    """Hours of one hourly bucket covered by readings: n readings x their mean gap, at most 1 h."""
    if count <= 0:
        return 0.0
    if count == 1 or first is None or last is None:
        return SAMPLE_INTERVAL_S / 3600
    span_s = (last - first).total_seconds()
    return min(3600.0, span_s * count / (count - 1)) / 3600


def energy_wh(buckets: list[dict]) -> tuple[float, float]:
    """Solar and lamp energy (Wh) of per-lamp hourly buckets: mean power x hours covered."""
    solar_wh = load_wh = 0.0
    for b in buckets:
        duration = bucket_duration_h(b.get("n") or 0, b.get("first"), b.get("last"))
        if b.get("solar_power") is not None:
            solar_wh += _num(b["solar_power"]) * POWER_SCALE * duration
        if b.get("power") is not None:
            load_wh += _num(b["power"]) * POWER_SCALE * duration
    return solar_wh, load_wh


def build_hourly(buckets: list[dict], start: datetime, hours: int = WINDOW_HOURS) -> tuple[list[dict], dict]:
    """Fleet series per hour and energy totals from per-lamp hourly buckets.

    Each bucket: ``bucket`` (hour start), ``solar_power`` / ``power`` (mean, telemetry
    units), ``bus_v``, ``lux``, ``temp_c`` (means), ``n``, ``first``, ``last``.
    Powers add up over lamps; voltage, light and temperature are averaged.
    Hours without data stay in the series with None values.
    """
    slots = {start + timedelta(hours=i): [] for i in range(hours)}
    for b in buckets:
        hour = b["bucket"]
        if hour.tzinfo is None:
            hour = hour.replace(tzinfo=UTC)
        hour = hour.astimezone(UTC)
        if hour in slots:
            slots[hour].append(b)

    def mean(values: list[float]) -> float | None:
        return sum(values) / len(values) if values else None

    series = []
    for hour, items in slots.items():
        solar = [_num(b["solar_power"]) * POWER_SCALE for b in items if b.get("solar_power") is not None]
        load = [_num(b["power"]) * POWER_SCALE for b in items if b.get("power") is not None]
        series.append({
            "time": hour.isoformat(),
            "solar_w": _round(sum(solar)) if solar else None,
            "load_w": _round(sum(load), 3) if load else None,
            "bus_v": _round(mean([_num(b["bus_v"]) for b in items if b.get("bus_v") is not None])),
            "lux": _round(mean([_num(b["lux"]) for b in items if b.get("lux") is not None]), 0),
            "temp_c": _round(mean([_num(b["temp_c"]) for b in items if b.get("temp_c") is not None]), 1),
        })

    solar_wh, load_wh = energy_wh([b for items in slots.values() for b in items])
    solar_peaks = [p["solar_w"] for p in series if p["solar_w"] is not None]
    load_peaks = [p["load_w"] for p in series if p["load_w"] is not None]
    energy = {
        "solar_wh": round(solar_wh, 2),
        "load_wh": round(load_wh, 2),
        "net_wh": round(solar_wh - load_wh, 2),
        "peak_solar_w": max(solar_peaks) if solar_peaks else None,
        "peak_load_w": max(load_peaks) if load_peaks else None,
        "hours_with_data": sum(1 for items in slots.values() if items),
    }
    return series, energy


def lamp_summary(lamp: Lamp, place_name: str | None, prediction: Prediction | None) -> dict:
    """One row of the dashboard lamp list: status plus the latest assessment."""
    details = (prediction.details if prediction is not None else None) or {}
    battery = details.get("battery") or {}
    issues = sorted(details.get("issues") or [], key=lambda i: SEVERITY_ORDER.get(i.get("severity"), 9))
    condition = details.get("condition") or None
    top = issues[0] if issues else None
    soc = battery.get("soc_pct")
    if soc is None:
        soc = _num(lamp.last_battery_level)
    return {
        "id": str(lamp.id),
        "lamp_code": lamp.lamp_code,
        "place_name": place_name,
        "status": getattr(lamp.status, "value", lamp.status),
        "risk_level": lamp.risk_level,
        "health_score": _num(lamp.health_score),
        "battery_soc": _round(_num(soc), 1),
        "autonomy_nights": _round(_num(battery.get("autonomy_nights")), 1),
        "hours_since_full": _round(_num(battery.get("hours_since_full")), 1),
        "nightly_consumption_ah": _round(_num(battery.get("nightly_consumption_ah")), 2),
        "days_to_failure": prediction.days_to_failure if prediction is not None else None,
        "issue_count": len(issues),
        "top_issue": (
            {k: top.get(k) for k in ("code", "component", "severity", "message")} if top else None
        ),
        "condition": (
            {k: condition.get(k) for k in ("label", "probability", "confirmed")} if condition else None
        ),
        "predicted_at": prediction.predicted_at.isoformat() if prediction is not None and prediction.predicted_at else None,
        "last_seen": lamp.last_seen.isoformat() if lamp.last_seen else None,
        "ml_ready": bool(lamp.ml_ready),
    }


def urgency(row: dict) -> int:
    """0 = act now (high risk or fault), 1 = needs attention (medium risk, warning, offline),
    2 = fine, 3 = no assessment yet. Same rule as needsAttention() on the dashboard."""
    risk, status = row["risk_level"], row["status"]
    if risk == "high" or status == "fault":
        return 0
    if risk == "medium" or status in ("warning", "offline"):
        return 1
    return 2 if risk == "low" else 3


def sort_lamps(rows: list[dict]) -> list[dict]:
    """Most urgent first, then by lamp status, then lowest health."""
    return sorted(rows, key=lambda r: (
        urgency(r),
        STATUS_ORDER.get(r["status"] or "", 5),
        r["health_score"] if r["health_score"] is not None else 101,
        r["lamp_code"],
    ))


def condition_counts(rows: list[dict]) -> dict[str, int]:
    """Lamps per Random Forest verdict; an unconfirmed verdict counts as normal."""
    counts: dict[str, int] = {}
    for r in rows:
        cond = r["condition"]
        if cond is None:
            label = "no_data"
        elif cond.get("confirmed") and cond.get("label"):
            label = cond["label"]
        else:
            label = "normal"
        counts[label] = counts.get(label, 0) + 1
    return counts


@lru_cache(maxsize=4)
def _model_card(path: Path, mtime: float) -> dict | None:
    card = json.loads(path.read_text(encoding="utf-8"))
    evaluation = (card.get("metrics") or {}).get("evaluation_leave_one_day_out") or {}
    forest, rules = evaluation.get("random_forest") or {}, evaluation.get("rules") or {}
    return {
        "version": card.get("model"),
        "trained_at": card.get("trained_at"),
        "classes": card.get("classes"),
        "windows": (card.get("metrics") or {}).get("windows"),
        "rf_accuracy": forest.get("accuracy"),
        "rf_f1_macro": forest.get("f1_macro"),
        "rf_false_alarm_rate": forest.get("false_alarm_rate"),
        "rules_accuracy": rules.get("accuracy"),
        "rules_f1_macro": rules.get("f1_macro"),
    }


def model_card(path: Path = MODEL_CARD_PATH) -> dict | None:
    """Headline numbers of the trained Random Forest (None before the first training)."""
    try:
        return _model_card(path, path.stat().st_mtime)
    except (OSError, ValueError):
        return None


async def hourly_buckets(
    db: AsyncSession, start: datetime | None, end: datetime | None, lamp_id: UUID | None = None
) -> list[dict]:
    """Per lamp and hour: mean powers (telemetry units), bus voltage, lux, valid temperature,
    and the count and first/last time of the readings. ``start``/``end`` None = unbounded."""
    temperature = func.coalesce(Telemetry.temperature_ambient, Telemetry.temperature_internal)
    valid_temperature = case((temperature.between(*TEMP_RANGE_C), temperature))
    # Truncate in UTC, whatever the session time zone is; the result is naive UTC. The
    # arguments are SQL literals, not bound parameters, so PostgreSQL sees the SELECT and
    # GROUP BY expressions as the same one.
    hour = func.date_trunc(literal_column("'hour'"), func.timezone(literal_column("'UTC'"), Telemetry.time))
    stmt = select(
        Telemetry.lamp_id,
        hour.label("bucket"),
        func.avg(Telemetry.solar_power).label("solar_power"),
        func.avg(Telemetry.power).label("power"),
        func.avg(func.coalesce(Telemetry.battery_voltage, Telemetry.voltage)).label("bus_v"),
        func.avg(Telemetry.lux).label("lux"),
        func.avg(valid_temperature).label("temp_c"),
        func.count().label("n"),
        func.min(Telemetry.time).label("first"),
        func.max(Telemetry.time).label("last"),
    ).group_by(Telemetry.lamp_id, hour)
    if start is not None:
        stmt = stmt.where(Telemetry.time >= start)
    if end is not None:
        stmt = stmt.where(Telemetry.time < end)
    if lamp_id is not None:
        stmt = stmt.where(Telemetry.lamp_id == lamp_id)
    return [dict(r._mapping) for r in await db.execute(stmt)]


async def hourly_window(db: AsyncSession, hours: int = WINDOW_HOURS, lamp_id: UUID | None = None) -> dict:
    """The fleet (or one lamp) per hour for ``hours`` ending with the newest reading."""
    stmt = select(func.max(Telemetry.time))
    if lamp_id is not None:
        stmt = stmt.where(Telemetry.lamp_id == lamp_id)
    last_data_at = await db.scalar(stmt)
    start, end = window_bounds(last_data_at, hours)
    series, energy = build_hourly(await hourly_buckets(db, start, end, lamp_id), start, hours)
    return {"last_data_at": last_data_at, "start": start, "end": end, "series": series, "energy": energy}


async def get_overview(db: AsyncSession) -> dict:
    window = await hourly_window(db)
    last_data_at, start, end = window["last_data_at"], window["start"], window["end"]
    hourly, energy = window["series"], window["energy"]

    latest = (
        select(Prediction.lamp_id, func.max(Prediction.predicted_at).label("at"))
        .group_by(Prediction.lamp_id)
        .subquery()
    )
    predictions = {
        p.lamp_id: p
        for p in await db.scalars(
            select(Prediction).join(
                latest, and_(Prediction.lamp_id == latest.c.lamp_id, Prediction.predicted_at == latest.c.at)
            )
        )
    }
    lamp_rows = await db.execute(
        select(Lamp, Place.name)
        .outerjoin(Place, Place.id == Lamp.place_id)
        .where(Lamp.is_deleted.is_(False))
    )
    lamps = sort_lamps([lamp_summary(lamp, place, predictions.get(lamp.id)) for lamp, place in lamp_rows.all()])

    return {
        "last_data_at": last_data_at.isoformat() if last_data_at else None,
        "window": {"start": start.isoformat(), "end": end.isoformat(), "hours": WINDOW_HOURS},
        "hourly": hourly,
        "energy": energy,
        "lamps": lamps,
        "conditions": condition_counts(lamps),
        "model": model_card(),
    }
