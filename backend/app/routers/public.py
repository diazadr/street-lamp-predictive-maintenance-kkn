from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Alert, Lamp, Telemetry
from app.schemas.telemetry import WIB
from app.services.energy_service import get_cost_comparison, get_energy_summary
from app.services.overview_service import POWER_SCALE, hourly_window
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/dashboard")
async def public_dashboard(db: AsyncSession = Depends(get_db)) -> dict:
    lamps = list(await db.scalars(select(Lamp).where(Lamp.is_deleted.is_(False)).order_by(Lamp.lamp_code).limit(8)))
    telemetry_rows = list(await db.scalars(select(Telemetry).order_by(Telemetry.time.desc()).limit(24)))
    latest = telemetry_rows[0] if telemetry_rows else None
    total_lamps = await db.scalar(select(func.count()).select_from(Lamp).where(Lamp.is_deleted.is_(False))) or 0
    online_lamps = await db.scalar(select(func.count()).select_from(Lamp).where(Lamp.status == "online", Lamp.is_deleted.is_(False))) or 0
    warning_lamps = await db.scalar(select(func.count()).select_from(Lamp).where(Lamp.status == "warning", Lamp.is_deleted.is_(False))) or 0
    offline_lamps = await db.scalar(select(func.count()).select_from(Lamp).where(Lamp.status == "offline", Lamp.is_deleted.is_(False))) or 0
    unresolved_alerts = await db.scalar(select(func.count()).select_from(Alert).where(Alert.is_resolved.is_(False))) or 0
    avg_battery = await db.scalar(select(func.avg(Lamp.last_battery_level)).where(Lamp.is_deleted.is_(False))) or 0
    avg_signal = await db.scalar(select(func.avg(Lamp.last_signal_strength)).where(Lamp.is_deleted.is_(False))) or 0
    energy = await get_energy_summary(db)
    cost = await get_cost_comparison(db)
    flow = await hourly_window(db, 12)

    def watts(value):
        return round(float(value) * POWER_SCALE, 3) if value is not None else None

    return {
        "kpi": {
            "total_lamps": total_lamps,
            "online_lamps": online_lamps,
            "warning_lamps": warning_lamps,
            "offline_lamps": offline_lamps,
            "unresolved_alerts": unresolved_alerts,
            "avg_battery_level": round(float(avg_battery), 1),
            "avg_signal_strength": round(float(avg_signal), 1),
        },
        "latestTelemetry": {
            "battery_level": float(latest.battery_level) if latest and latest.battery_level is not None else None,
            "solar_power": watts(latest.solar_power) if latest else None,
            "power": watts(latest.power) if latest else None,
            "temperature_ambient": float(latest.temperature_ambient) if latest and latest.temperature_ambient is not None else None,
            "temperature_internal": float(latest.temperature_internal) if latest and latest.temperature_internal is not None else None,
            "lux": float(latest.lux) if latest and latest.lux is not None else None,
            "motion_count": latest.motion_count if latest else None,
            "signal_strength": float(latest.signal_strength) if latest and latest.signal_strength is not None else None,
            "mqtt_latency_ms": latest.mqtt_latency_ms if latest else None,
            "brightness": float(latest.brightness) if latest and latest.brightness is not None else None,
        },
        "lamps": [
            {
                "id": lamp.lamp_code,
                "location": str(lamp.place_id) if lamp.place_id else "Unassigned",
                "status": lamp.status,
                "battery": float(lamp.last_battery_level or 0),
                "brightness": float(lamp.last_brightness or 0),
            }
            for lamp in lamps
        ],
        "energy": {
            # today (WIB), in Wh
            "dailyGenerated": round(energy["solar_generated_today"] * 1000, 2),
            "dailyConsumed": round(energy["consumed_today"] * 1000, 2),
            "efficiency": energy["efficiency_pct"],
            "co2Saved": energy["co2_avoided_kg"],
            "treesEquivalent": energy["co2_avoided_kg"] / 21.77 if energy["co2_avoided_kg"] else 0,
            "costSaving": 100 if cost["estimated_saving"] else 0,
            "currency": cost["currency"],
            "traditionalMonthlyCost": cost["traditional_monthly_cost"],
            "smartMonthlyCost": cost["smart_monthly_cost"],
        },
        # last 12 hours up to the newest reading, W per hour, local (WIB) hour labels
        "energyFlow": [
            {
                "hour": datetime.fromisoformat(p["time"]).astimezone(WIB).strftime("%H"),
                "generated": p["solar_w"],
                "consumed": p["load_w"],
            }
            for p in flow["series"]
        ],
        "sensorSeries": {
            "labels": [row.time.strftime("%H:%M") for row in reversed(telemetry_rows[-7:])],
            "lightSensor": [float(row.lux or 0) for row in reversed(telemetry_rows[-7:])],
            "temperature": [float(row.temperature_ambient or row.temperature_internal or 0) for row in reversed(telemetry_rows[-7:])],
            "motion": [row.motion_count or 0 for row in reversed(telemetry_rows[-7:])],
        },
    }


@router.get("/lamps")
async def public_lamps(db: AsyncSession = Depends(get_db)) -> list[dict]:
    """Sebaran lampu untuk peta di landing page (tanpa data sensitif: tanpa ID internal & firmware)."""
    lamps = await db.scalars(
        select(Lamp)
        .options(selectinload(Lamp.place))
        .where(Lamp.is_deleted.is_(False), Lamp.latitude.is_not(None), Lamp.longitude.is_not(None))
        .order_by(Lamp.lamp_code)
        .limit(500)
    )
    return [
        {
            "code": lamp.lamp_code,
            "place": lamp.place.name if lamp.place else None,
            "latitude": float(lamp.latitude),
            "longitude": float(lamp.longitude),
            "status": lamp.status,
            "battery": float(lamp.last_battery_level) if lamp.last_battery_level is not None else None,
            "brightness": float(lamp.last_brightness) if lamp.last_brightness is not None else None,
            "health_score": float(lamp.health_score) if lamp.health_score is not None else None,
            "risk_level": lamp.risk_level,
            "last_seen": lamp.last_seen,
        }
        for lamp in lamps
    ]
