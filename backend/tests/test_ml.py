import asyncio
import math
from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.ml import engine
from app.schemas.telemetry import TelemetryCreate
from app.tasks import ml_tasks

WIB = timezone(timedelta(hours=7))


def make_rows(hours: int = 48, start: datetime = datetime(2026, 10, 22, 6, 0, tzinfo=WIB), **override) -> list:
    """Telemetry rows like the ESP32 sends them (V, mA, mW): charge until 09:00, then full; LED at night."""
    rows = []
    for k in range(hours * 60):
        t = start + timedelta(minutes=k)
        hour = t.hour + t.minute / 60
        sun = max(0.0, math.sin((hour - 6) / 12 * math.pi))
        lux = 20_000 * sun + 1.5
        if sun > 0 and hour < 9:            # charging
            i_batt, i_solar, v = -min(lux / 10, 1800.0), min(lux / 10, 1800.0), 3.45
        elif sun > 0:                       # full: bus floats at panel voltage
            i_batt, i_solar, v = 0.0, 4.0, 7.2
        else:                               # night: battery feeds the PWM-dimmed LED
            i_batt, i_solar, v = 140.0, 0.0, 3.28
        i_load = 140.0 if sun == 0 else 0.0
        row = dict(
            time=t.astimezone(UTC), solar_voltage=v, battery_voltage=v, voltage=v,
            solar_current=i_solar, battery_current=i_batt, current=i_load,
            solar_power=v * i_solar, power=v * i_load, lux=lux,
            temperature_ambient=25 + 8 * sun, temperature_internal=None,
        )
        row.update({key: (fn(row) if callable(fn) else fn) for key, fn in override.items()})
        rows.append(SimpleNamespace(**row))
    return rows


@pytest.fixture(autouse=True)
def no_trained_artifacts(monkeypatch, tmp_path):
    """Tests use the default baseline and no forest unless they opt in."""
    monkeypatch.setattr(engine, "BASELINE_PATH", tmp_path / "baseline.json")
    monkeypatch.setattr(engine, "CONDITION_MODEL_PATH", tmp_path / "condition_rf.joblib")
    engine.load_baseline.cache_clear()
    engine.load_condition_model.cache_clear()
    yield
    engine.load_baseline.cache_clear()
    engine.load_condition_model.cache_clear()


def _codes(result: dict) -> list[str]:
    return [i["code"] for i in result["issues"]]


def test_healthy_lamp_in_device_units() -> None:
    result = engine.assess_rows(make_rows())
    assert result["risk_level"] == "low"
    assert result["health_score"] == 100
    assert result["lamp"]["on_current_a"] == pytest.approx(0.14)   # 140 mA converted to A
    assert 0 < result["battery"]["soc_pct"] <= 100
    assert result["battery"]["capacity_ah"] == 5.0                 # product: 5000 mAh LiFePO4


def test_dead_battery_at_night_is_critical() -> None:
    rows = make_rows()
    for row in rows[-30:]:  # last half hour, still dark
        row.battery_voltage = row.voltage = row.solar_voltage = 2.6
    result = engine.assess_rows(rows)
    assert "BATTERY_CRITICAL" in _codes(result)
    assert result["risk_level"] == "high"


def test_temperature_internal_is_used_when_ambient_is_missing() -> None:
    rows = make_rows(temperature_ambient=None, temperature_internal=lambda r: 26.0)
    assert "SENSOR_TEMPERATURE" not in _codes(engine.assess_rows(rows))
    no_temp = make_rows(temperature_ambient=None)
    assert "SENSOR_TEMPERATURE" in _codes(engine.assess_rows(no_temp))


def test_battery_spec_follows_the_lamp_record() -> None:
    assert engine.battery_spec_for(SimpleNamespace(battery_capacity_wh=16)).capacity_ah == pytest.approx(5.0)
    assert engine.battery_spec_for(SimpleNamespace(battery_capacity_wh=38.4)).capacity_ah == pytest.approx(12.0)
    assert engine.battery_spec_for(SimpleNamespace(battery_capacity_wh=None)).capacity_ah == 5.0
    assert engine.battery_spec_for(None).capacity_ah == 5.0


def test_apply_result_updates_lamp_and_builds_prediction() -> None:
    result = engine.assess_rows(make_rows())
    lamp = SimpleNamespace(id=uuid4(), lamp_code="PJU-01", risk_level=None, health_score=None, last_battery_level=None)
    prediction = ml_tasks.apply_result(lamp, result)
    assert lamp.risk_level == "low" and lamp.health_score == 100
    assert lamp.last_battery_level == result["battery"]["soc_pct"]
    assert prediction.lamp_id == lamp.id
    assert prediction.model_version == result["model_version"]
    assert set(prediction.details) == set(ml_tasks.DETAIL_FIELDS)


class FakeDB:
    def __init__(self, open_alert_types):
        self.open_alert_types = open_alert_types
        self.added = []

    async def scalars(self, _statement):
        return list(self.open_alert_types)

    def add(self, obj):
        self.added.append(obj)


def test_alerts_only_for_new_warning_or_critical_issues() -> None:
    db = FakeDB(["pm_lamp_not_on"])
    lamp = SimpleNamespace(id=uuid4(), lamp_code="PJU-01")
    issues = [
        {"code": "LAMP_NOT_ON", "severity": "critical", "message": "Lampu tidak menyala.", "value": 0.0},
        {"code": "BATTERY_LOW", "severity": "warning", "message": "Tegangan baterai rendah.", "value": 3.05},
        {"code": "DATA_GAPS", "severity": "info", "message": "Data tidak lengkap.", "value": 0.4},
    ]
    created = asyncio.run(ml_tasks.raise_issue_alerts(db, lamp, issues))
    assert [a.alert_type for a in created] == ["pm_battery_low"]
    assert created[0].message.startswith("PJU-01: ")


def test_logger_payload_is_accepted() -> None:
    payload = TelemetryCreate(**{
        "lamp_code": "PJU-01", "Timestamp": "22/10/2026 18:00:00",
        "V2_Batt": 3.28, "I2_Batt": 141.2, "I3_Load": 140.7, "Temp_C": 25.94, "P2_Batt": 460.0,
    })
    assert payload.battery_voltage == 3.28
    assert payload.battery_current == 141.2
    assert payload.current == 140.7
    assert payload.temperature_ambient == 25.94
    assert payload.timestamp == datetime(2026, 10, 22, 11, 0, tzinfo=UTC)


def test_trained_artifacts_load_if_present() -> None:
    engine.load_condition_model.cache_clear()
    real_dir = engine.MODEL_DIR
    if not (real_dir / "condition_rf.joblib").exists():
        pytest.skip("model not trained in this checkout")
    from pju_ml.training import ConditionModel

    model = ConditionModel.load(real_dir / "condition_rf.joblib")
    assert model.version.startswith("rf-condition-")
    assert "normal" in model.classes
