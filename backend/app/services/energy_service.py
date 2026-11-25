"""Energy totals for the energy page and the public landing page.

Energy is integrated from the powers the logger sends (mW, converted in
overview_service), per lamp and hour. The ESP32 does not send the cumulative
``energy`` / ``solar_energy_today`` fields, so they are not used.
"""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EnergyCostConfig, Lamp
from app.schemas.telemetry import WIB
from app.services.overview_service import energy_wh, hourly_buckets

CO2_KG_PER_KWH = 0.85  # grid emission factor used across the app


def summarize(lamp_count: int, total: tuple[float, float], today: tuple[float, float]) -> dict:
    """Summary fields from (solar Wh, lamp Wh) over all data and since local midnight."""
    (solar_wh, load_wh), (solar_today_wh, load_today_wh) = total, today

    def ratio(solar: float, load: float) -> float:
        return round(solar / load * 100, 1) if load > 0 else 0

    return {
        "lamp_count": lamp_count,
        # all data
        "solar_generated_kwh": round(solar_wh / 1000, 6),
        "energy_consumed_kwh": round(load_wh / 1000, 6),
        "co2_avoided_kg": round(solar_wh / 1000 * CO2_KG_PER_KWH, 6),
        "efficiency_percent": ratio(solar_wh, load_wh),
        # today (WIB)
        "solar_generated_today": round(solar_today_wh / 1000, 6),
        "consumed_today": round(load_today_wh / 1000, 6),
        "efficiency_pct": ratio(solar_today_wh, load_today_wh),
    }


async def get_energy_summary(db: AsyncSession, now: datetime | None = None) -> dict:
    lamp_count = await db.scalar(
        select(func.count()).select_from(Lamp).where(Lamp.is_deleted.is_(False))
    ) or 0
    now = now or datetime.now(UTC)
    today_start = now.astimezone(WIB).replace(hour=0, minute=0, second=0, microsecond=0)
    total = energy_wh(await hourly_buckets(db, None, None))
    today = energy_wh(await hourly_buckets(db, today_start, None))
    return summarize(lamp_count, total, today)


async def get_cost_comparison(db: AsyncSession, hours_on: float = 12.0) -> dict:
    config = await db.scalar(
        select(EnergyCostConfig).where(EnergyCostConfig.is_active.is_(True))
    )
    lamp_count = await db.scalar(
        select(func.count()).select_from(Lamp).where(Lamp.is_deleted.is_(False))
    ) or 0
    rate = float(config.electricity_rate) if config else 1444.70
    watt = float(config.traditional_lamp_watt) if config and config.traditional_lamp_watt else 150.0
    traditional = (watt * hours_on * 30 / 1000) * rate * lamp_count
    return {
        "currency": config.currency if config else "IDR",
        "traditional_monthly_cost": round(traditional, 2),
        "smart_monthly_cost": 0,
        "estimated_saving": round(traditional, 2),
    }
