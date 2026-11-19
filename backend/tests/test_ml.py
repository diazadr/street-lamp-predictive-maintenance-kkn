from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pandas as pd

from app.ml import train as train_module
from app.ml.features import build_features, label_condition
from app.tasks import ml_tasks


def _rows(n: int, **overrides) -> list[dict]:
    base = {
        "solar_voltage": 3.3, "solar_current": 0.0, "solar_power": 0.0,
        "battery_voltage": 3.3, "battery_current": 90.0,
        "voltage": 3.3, "current": 90.0, "power": 300.0,
        "lux": 2.0, "temperature_internal": 25.0,
    }
    return [{**base, **overrides} for _ in range(n)]


def _synthetic_frame() -> pd.DataFrame:
    return pd.DataFrame(
        _rows(60)  # malam, lampu menyala -> normal
        + _rows(30, battery_voltage=3.1)  # baterai rendah -> perlu perhatian
        + _rows(30, battery_voltage=0.8, voltage=0.0, current=0.0, power=0.0)  # baterai drop -> gangguan
    )


def test_labels_cover_three_conditions() -> None:
    labels = label_condition(build_features(_synthetic_frame()))
    assert labels.iloc[0] == 0
    assert labels.iloc[70] == 1
    assert labels.iloc[-1] == 2


def test_ml_prediction_uses_trained_model(tmp_path, monkeypatch) -> None:
    X = build_features(_synthetic_frame())
    y = label_condition(X)
    result = train_module.train_model(pd.concat([X] * 5, ignore_index=True), pd.concat([y] * 5, ignore_index=True))
    model_path = tmp_path / "model.joblib"
    train_module.save_model(result, model_path, {})
    monkeypatch.setattr(ml_tasks, "MODEL_PATH", model_path)

    now = datetime.now(UTC)

    def as_rows(records):
        return [SimpleNamespace(time=now - timedelta(seconds=14 * (len(records) - i)), **r) for i, r in enumerate(records)]

    healthy = ml_tasks._ml_prediction(as_rows(_rows(60)))
    assert healthy["risk_level"] == "low"

    failing = ml_tasks._ml_prediction(as_rows(_rows(40) + _rows(25, battery_voltage=0.8, voltage=0.0, current=0.0, power=0.0)))
    assert failing["risk_level"] == "high"
    assert "baterai" in failing["recommendation"].lower()
