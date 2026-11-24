from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

from app.main import app
from app.services.overview_service import (
    SAMPLE_INTERVAL_S,
    bucket_duration_h,
    build_hourly,
    condition_counts,
    lamp_summary,
    model_card,
    sort_lamps,
    window_bounds,
)

T0 = datetime(2026, 10, 22, 11, 0, tzinfo=UTC)  # 18:00 WIB


def bucket(hour: datetime, solar_mw: float | None, load_mw: float | None, n: int = 257, **extra) -> dict:
    """One lamp-hour as the SQL query returns it; readings ~14 s apart over the whole hour."""
    return {
        "bucket": hour.replace(tzinfo=None),  # date_trunc in UTC comes back naive
        "solar_power": solar_mw,
        "power": load_mw,
        "bus_v": extra.get("bus_v", 3.3),
        "lux": extra.get("lux", 0.0),
        "temp_c": extra.get("temp_c", 25.0),
        "n": n,
        "first": hour,
        "last": hour + timedelta(seconds=14 * (n - 1)),
    }


def test_route_is_registered() -> None:
    assert "/monitoring/overview" in {route.path for route in app.routes}


def test_window_ends_with_the_hour_of_the_newest_reading() -> None:
    start, end = window_bounds(datetime(2026, 10, 23, 6, 47, 12, tzinfo=UTC))
    assert end == datetime(2026, 10, 23, 7, 0, tzinfo=UTC)
    assert end - start == timedelta(hours=24)


def test_bucket_duration() -> None:
    assert bucket_duration_h(0, None, None) == 0
    assert bucket_duration_h(1, T0, T0) == SAMPLE_INTERVAL_S / 3600
    # 257 readings 14 s apart: 257 x 14 s
    assert abs(bucket_duration_h(257, T0, T0 + timedelta(seconds=14 * 256)) - 257 * 14 / 3600) < 1e-9
    # never more than the hour itself
    assert bucket_duration_h(400, T0, T0 + timedelta(seconds=3599)) == 1.0
    # half an hour of readings
    assert abs(bucket_duration_h(129, T0, T0 + timedelta(seconds=14 * 128)) - 129 * 14 / 3600) < 1e-9


def test_hourly_series_converts_mw_and_fills_gaps() -> None:
    start = T0 - timedelta(hours=23)
    series, energy = build_hourly(
        [bucket(start, 5000.0, 0.0, lux=20000), bucket(T0, 0.0, 460.0)],
        start,
    )
    assert len(series) == 24
    assert series[0]["solar_w"] == 5.0 and series[0]["load_w"] == 0.0 and series[0]["lux"] == 20000
    assert series[-1]["load_w"] == 0.46
    assert all(p["solar_w"] is None for p in series[1:-1])  # no data -> gap, not zero
    assert energy["solar_wh"] == 5.0
    assert energy["load_wh"] == 0.46
    assert energy["net_wh"] == 4.54
    assert energy["peak_solar_w"] == 5.0
    assert energy["hours_with_data"] == 2


def test_powers_add_up_over_lamps_and_voltage_is_averaged() -> None:
    series, energy = build_hourly(
        [bucket(T0, 1000.0, 300.0, bus_v=3.2), bucket(T0, 3000.0, 100.0, bus_v=3.4)],
        T0,
        hours=1,
    )
    assert series[0]["solar_w"] == 4.0
    assert series[0]["load_w"] == 0.4
    assert series[0]["bus_v"] == 3.3
    assert energy["solar_wh"] == 4.0


def test_buckets_outside_the_window_are_ignored() -> None:
    series, energy = build_hourly([bucket(T0 - timedelta(hours=30), 9000.0, 0.0)], T0, hours=2)
    assert energy["solar_wh"] == 0 and energy["hours_with_data"] == 0
    assert series[0]["solar_w"] is None


def lamp(**kw):
    defaults = dict(
        id=uuid4(), lamp_code="PJU-01", status="online", risk_level="low", health_score=100,
        last_battery_level=None, last_seen=T0, ml_ready=True,
    )
    return SimpleNamespace(**{**defaults, **kw})


def prediction(details: dict, days_to_failure=None):
    return SimpleNamespace(details=details, days_to_failure=days_to_failure, predicted_at=T0)


def test_lamp_summary_takes_battery_and_top_issue_from_the_prediction() -> None:
    p = prediction({
        "battery": {"soc_pct": 62.44, "autonomy_nights": 4.26, "hours_since_full": 15.23, "nightly_consumption_ah": 1.188},
        "issues": [
            {"code": "LAMP_DIM", "component": "lamp", "severity": "info", "message": "redup"},
            {"code": "NO_FULL_CHARGE", "component": "battery", "severity": "warning", "message": "belum penuh"},
        ],
        "condition": {"label": "lamp_dim", "probability": 0.81, "confirmed": False, "windows_flagged": 3},
    }, days_to_failure=4)
    row = lamp_summary(lamp(risk_level="medium", health_score=85), "Blok Lebak Bitung", p)
    assert row["battery_soc"] == 62.4
    assert row["autonomy_nights"] == 4.3
    assert row["hours_since_full"] == 15.2
    assert row["nightly_consumption_ah"] == 1.19
    assert row["top_issue"]["code"] == "NO_FULL_CHARGE"  # warning before info
    assert row["issue_count"] == 2
    assert row["condition"] == {"label": "lamp_dim", "probability": 0.81, "confirmed": False}
    assert row["days_to_failure"] == 4
    assert row["place_name"] == "Blok Lebak Bitung"


def test_lamp_without_prediction_falls_back_to_the_lamp_record() -> None:
    row = lamp_summary(lamp(last_battery_level=55, risk_level=None, health_score=None), None, None)
    assert row["battery_soc"] == 55.0
    assert row["top_issue"] is None and row["condition"] is None and row["predicted_at"] is None


def test_sort_puts_the_most_urgent_lamp_first() -> None:
    rows = [
        {"lamp_code": "A", "risk_level": "low", "status": "online", "health_score": 100},
        {"lamp_code": "B", "risk_level": None, "status": "offline", "health_score": None},
        {"lamp_code": "C", "risk_level": "high", "status": "online", "health_score": 30},
        {"lamp_code": "D", "risk_level": "low", "status": "fault", "health_score": 90},
        {"lamp_code": "E", "risk_level": "medium", "status": "online", "health_score": 85},
        {"lamp_code": "F", "risk_level": None, "status": "online", "health_score": None},
    ]
    # high risk / fault, then medium risk / offline, then healthy, then not yet assessed
    assert [r["lamp_code"] for r in sort_lamps(rows)] == ["D", "C", "B", "E", "A", "F"]


def test_condition_counts_only_count_confirmed_faults() -> None:
    rows = [
        {"condition": {"label": "lamp_dim", "confirmed": True}},
        {"condition": {"label": "lamp_dim", "confirmed": False}},
        {"condition": {"label": "normal", "confirmed": False}},
        {"condition": None},
    ]
    assert condition_counts(rows) == {"lamp_dim": 1, "normal": 2, "no_data": 1}


def test_model_card_headline_numbers(tmp_path) -> None:
    card = model_card()
    if card is not None:  # trained artifacts are committed, but tolerate a fresh checkout
        assert 0 < card["rf_accuracy"] <= 1
        assert card["rules_accuracy"] is not None
    assert model_card(tmp_path / "missing.json") is None
