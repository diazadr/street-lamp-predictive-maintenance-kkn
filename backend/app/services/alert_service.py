from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert, AlertThreshold, Lamp


async def create_alerts_for_thresholds(db: AsyncSession, lamp: Lamp, payload: dict) -> list[Alert]:
    thresholds = await db.scalars(select(AlertThreshold).where(AlertThreshold.is_active.is_(True)))
    # Telemetry arrives every ~14 s: while an alert of a kind is unresolved, do not add another.
    open_types = set(
        await db.scalars(select(Alert.alert_type).where(Alert.lamp_id == lamp.id, Alert.is_resolved.is_(False)))
    )
    created: list[Alert] = []
    for threshold in thresholds:
        value = payload.get(threshold.metric)
        if value is None:
            continue
        metric_value = float(value)
        warning = float(threshold.warning_value) if threshold.warning_value is not None else None
        critical = float(threshold.critical_value) if threshold.critical_value is not None else None
        severity = None
        if threshold.condition == "lt":
            if critical is not None and metric_value <= critical:
                severity = "critical"
            elif warning is not None and metric_value <= warning:
                severity = "warning"
        elif threshold.condition == "gt":
            if critical is not None and metric_value >= critical:
                severity = "critical"
            elif warning is not None and metric_value >= warning:
                severity = "warning"
        if not severity or threshold.metric in open_types:
            continue

        alert = Alert(
            lamp_id=lamp.id,
            threshold_id=threshold.id,
            alert_type=threshold.metric,
            severity=severity,
            message=f"{threshold.name}: {round(float(metric_value), 2):g}",
            metric_value=metric_value,
        )
        db.add(alert)
        open_types.add(threshold.metric)
        created.append(alert)
    return created
