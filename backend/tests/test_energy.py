from datetime import UTC, datetime, timedelta

from app.main import app
from app.services.energy_service import CO2_KG_PER_KWH, summarize
from app.services.overview_service import energy_wh

T0 = datetime(2026, 10, 23, 11, 0, tzinfo=UTC)


def bucket(solar_mw: float | None, load_mw: float | None, n: int = 257) -> dict:
    return {
        "bucket": T0.replace(tzinfo=None),
        "solar_power": solar_mw,
        "power": load_mw,
        "n": n,
        "first": T0,
        "last": T0 + timedelta(seconds=14 * (n - 1)),
    }


def test_energy_is_mean_power_times_covered_hours() -> None:
    solar_wh, load_wh = energy_wh([bucket(7750.0, 0.0), bucket(None, 460.0, n=129)])
    assert abs(solar_wh - 7.75 * 257 * 14 / 3600) < 1e-9
    assert abs(load_wh - 0.46 * 129 * 14 / 3600) < 1e-9


def test_no_buckets_no_energy() -> None:
    assert energy_wh([]) == (0.0, 0.0)


def test_summary_fields_in_kwh_with_today_separate() -> None:
    s = summarize(1, total=(820.0, 4360.0), today=(0.0, 0.0))
    assert s["solar_generated_kwh"] == 0.82
    assert s["energy_consumed_kwh"] == 4.36
    assert s["co2_avoided_kg"] == round(0.82 * CO2_KG_PER_KWH, 6)
    assert s["efficiency_percent"] == 18.8
    assert s["solar_generated_today"] == 0 and s["efficiency_pct"] == 0  # no load today: no ratio


def test_small_energies_keep_their_precision() -> None:
    # 0.82 Wh is 0.00082 kWh; rounding to 3 decimals used to turn it into 0.001
    assert summarize(1, total=(0.82, 0), today=(0.82, 0))["solar_generated_today"] == 0.00082


def test_trend_takes_an_hour_range() -> None:
    trend = next(r for r in app.routes if getattr(r, "path", "") == "/monitoring/trend")
    names = {p.name for p in trend.dependant.query_params}
    assert {"hours", "lamp_id"} <= names
