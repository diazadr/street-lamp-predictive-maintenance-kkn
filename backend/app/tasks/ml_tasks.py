"""ML predictive-maintenance tasks.

- run_ml_prediction(lamp_id): assess one lamp from its last 72 h of telemetry with
  ``pju_ml`` (rule engine + battery model + Random Forest condition classifier),
  save the prediction, update the lamp and raise alerts for new problems.
- run_ml_all_lamps(): the same for every ml_ready lamp (Celery beat, hourly).

Models are trained offline with ``python -m app.ml.train`` (see app/ml/train.py).
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.ml.engine import LOOKBACK_HOURS, assess_rows
from app.models import Alert, Lamp, Prediction, Telemetry
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

PREDICTION_FIELDS = ("failure_probability", "days_to_failure", "risk_level", "recommendation",
                     "model_version", "confidence")
DETAIL_FIELDS = ("health_score", "component_health", "issues", "battery", "lamp", "condition",
                 "assessed_at", "data_hours")
ALERT_SEVERITIES = {"critical", "warning"}
ALERT_PREFIX = "pm_"  # alert_type of predictive-maintenance alerts, e.g. pm_lamp_not_on


async def _fetch_rows(db, lamp_id: UUID, now: datetime) -> list[Telemetry]:
    since = now - timedelta(hours=LOOKBACK_HOURS)
    return list(
        await db.scalars(
            select(Telemetry)
            .where(Telemetry.lamp_id == lamp_id, Telemetry.time >= since, Telemetry.time <= now)
            .order_by(Telemetry.time)
        )
    )


async def raise_issue_alerts(db, lamp: Lamp, issues: list[dict]) -> list[Alert]:
    """One alert per warning/critical issue, unless the same kind is still unresolved."""
    open_types = set(
        await db.scalars(
            select(Alert.alert_type).where(Alert.lamp_id == lamp.id, Alert.is_resolved.is_(False))
        )
    )
    created = []
    for issue in issues:
        if issue["severity"] not in ALERT_SEVERITIES:
            continue
        alert_type = f"{ALERT_PREFIX}{issue['code'].lower()}"
        if alert_type in open_types:
            continue
        alert = Alert(
            lamp_id=lamp.id,
            alert_type=alert_type,
            severity=issue["severity"],
            message=f"{lamp.lamp_code}: {issue['message']}",
            metric_value=issue.get("value"),
        )
        db.add(alert)
        open_types.add(alert_type)
        created.append(alert)
    return created


def apply_result(lamp: Lamp, result: dict) -> Prediction:
    """Update the lamp from an assessment and build the Prediction row."""
    lamp.risk_level = result["risk_level"]
    lamp.health_score = result["health_score"]
    soc = (result.get("battery") or {}).get("soc_pct")
    if soc is not None:
        lamp.last_battery_level = soc  # the firmware sends no battery level; this is the estimate
    return Prediction(
        lamp_id=lamp.id,
        **{k: result[k] for k in PREDICTION_FIELDS},
        details={k: result.get(k) for k in DETAIL_FIELDS},
    )


async def _run_prediction(lamp_id_str: str, now: datetime | None = None) -> dict:
    lamp_id = UUID(lamp_id_str)
    now = now or datetime.now(UTC)
    async with AsyncSessionLocal() as db:
        lamp = await db.get(Lamp, lamp_id)
        if not lamp or lamp.is_deleted:
            return {"error": "Lamp not found"}
        if not lamp.ml_ready:
            return {"error": "Not enough data", "telemetry_count": lamp.telemetry_count}

        rows = await _fetch_rows(db, lamp_id, now)
        result = assess_rows(rows, lamp=lamp, now=now)
        if result is None:
            return {"error": "No telemetry in the last 24 hours"}

        db.add(apply_result(lamp, result))
        await raise_issue_alerts(db, lamp, result["issues"])
        await db.commit()
        return result


async def _run_all() -> dict:
    async with AsyncSessionLocal() as db:
        lamps = list(await db.scalars(select(Lamp).where(Lamp.is_deleted.is_(False), Lamp.ml_ready.is_(True))))

    summary = {"total": len(lamps), "success": 0, "error": 0, "high_risk": 0}
    for lamp in lamps:
        try:
            result = await _run_prediction(str(lamp.id))
        except Exception as exc:
            logger.error("Prediction failed for %s: %s", lamp.lamp_code, exc)
            summary["error"] += 1
            continue
        if "error" in result:
            summary["error"] += 1
            continue
        summary["success"] += 1
        summary["high_risk"] += result.get("risk_level") == "high"
    return summary


@celery_app.task
def run_ml_prediction(lamp_id: str) -> str:
    """Celery task: assess a single lamp."""
    result = asyncio.run(_run_prediction(lamp_id))
    return f"Prediction for {lamp_id}: risk={result.get('risk_level', 'error')}, health={result.get('health_score', 'N/A')}"


@celery_app.task
def run_ml_all_lamps() -> str:
    """Celery task: assess every ml_ready lamp."""
    s = asyncio.run(_run_all())
    return f"ML: {s['success']}/{s['total']} success, {s['high_risk']} high risk, {s['error']} errors"


@celery_app.task
def run_daily_ml_all_lamps() -> str:
    """Kept for schedules that still use the old task name."""
    return run_ml_all_lamps()
