"""ML Predictive Maintenance tasks.

- run_ml_prediction(lamp_id): Ambil telemetry terbaru, klasifikasikan kondisi tiap
  sampel dengan RandomForest (Normal / Perlu Perhatian / Gangguan), simpan prediksi,
  update lamp risk_level. Model dilatih via ``python -m app.ml.train``.
- run_daily_ml_all_lamps(): Iterate all ml_ready lamps and run predictions.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal
from app.ml.features import RAW_COLUMNS, ROLLING_WINDOW, build_features, describe_issues
from app.models import Alert, Lamp, Prediction, Telemetry
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent.parent / "ml_models"
MODEL_PATH = MODEL_DIR / "failure_predictor.joblib"

# Feature engineering constants
MIN_DATA_POINTS = 48  # ~4 days at 2-hour intervals
FEATURE_COLUMNS = [
    "voltage", "current", "power", "battery_level", "battery_voltage",
    "solar_power", "temperature_internal", "temperature_ambient",
    "lux", "signal_strength", "anomaly_score",
]


async def _fetch_recent_rows(db, lamp_id) -> list[Telemetry]:
    """Telemetry 7 hari terakhir (maks 500 baris), urut terbaru dulu."""
    since = datetime.now(UTC) - timedelta(days=7)
    return list(
        await db.scalars(
            select(Telemetry)
            .where(Telemetry.lamp_id == lamp_id, Telemetry.time >= since)
            .order_by(Telemetry.time.desc())
            .limit(500)
        )
    )


def _extract_features(rows: list[Telemetry]) -> dict | None:
    """Extract statistical features (untuk fallback rule-based)."""
    if len(rows) < MIN_DATA_POINTS:
        return None

    data = []
    for row in rows:
        record = {}
        for col in FEATURE_COLUMNS:
            val = getattr(row, col, None)
            record[col] = float(val) if val is not None else np.nan
        data.append(record)

    df = pd.DataFrame(data)

    features = {}
    for col in FEATURE_COLUMNS:
        if col in df.columns:
            series = df[col].dropna()
            if len(series) > 0:
                features[f"{col}_mean"] = series.mean()
                features[f"{col}_std"] = series.std() if len(series) > 1 else 0.0
                features[f"{col}_min"] = series.min()
                features[f"{col}_max"] = series.max()
                features[f"{col}_range"] = series.max() - series.min()
                features[f"{col}_last"] = series.iloc[0]
            else:
                for suffix in ["mean", "std", "min", "max", "range", "last"]:
                    features[f"{col}_{suffix}"] = 0.0
        else:
            for suffix in ["mean", "std", "min", "max", "range", "last"]:
                features[f"{col}_{suffix}"] = 0.0

    # Derived features
    features["data_points"] = len(rows)
    features["data_freshness_hours"] = (
        (datetime.now(UTC) - rows[0].time).total_seconds() / 3600 if rows else 999
    )

    # Battery degradation rate (slope over last 7 days)
    battery_series = df["battery_level"].dropna()
    if len(battery_series) >= 5:
        x = np.arange(len(battery_series))
        slope = np.polyfit(x, battery_series.values, 1)[0]
        features["battery_slope"] = float(slope)
    else:
        features["battery_slope"] = 0.0

    # Anomaly frequency
    anomaly_series = df["anomaly_score"].dropna()
    if len(anomaly_series) > 0:
        features["anomaly_freq"] = float((anomaly_series > 0.7).sum() / len(anomaly_series))
    else:
        features["anomaly_freq"] = 0.0

    return features


def _rule_based_prediction(features: dict) -> dict:
    """Fallback rule-based prediction when no ML model is available."""
    score = 0.0
    reasons = []

    # Battery health
    batt_mean = features.get("battery_level_mean", 100)
    if batt_mean < 20:
        score += 0.3
        reasons.append("Rata-rata baterai sangat rendah")
    elif batt_mean < 40:
        score += 0.15
        reasons.append("Rata-rata baterai rendah")

    # Battery degradation
    slope = features.get("battery_slope", 0)
    if slope < -2.0:
        score += 0.2
        reasons.append("Baterai menurun cepat")

    # Anomaly frequency
    anomaly_freq = features.get("anomaly_freq", 0)
    if anomaly_freq > 0.3:
        score += 0.25
        reasons.append("Frekuensi anomali tinggi")
    elif anomaly_freq > 0.1:
        score += 0.1

    # Temperature
    temp_max = features.get("temperature_internal_max", 25)
    if temp_max > 70:
        score += 0.15
        reasons.append("Suhu internal sangat tinggi")
    elif temp_max > 55:
        score += 0.05

    # Signal issues
    signal_mean = features.get("signal_strength_mean", 100)
    if signal_mean < 20:
        score += 0.1
        reasons.append("Sinyal sangat lemah")

    score = min(score, 1.0)

    if score >= 0.6:
        risk = "high"
        days = max(1, int((1 - score) * 14))
    elif score >= 0.3:
        risk = "medium"
        days = max(7, int((1 - score) * 30))
    else:
        risk = "low"
        days = max(30, int((1 - score) * 90))

    rec = "; ".join(reasons) if reasons else "Kondisi normal, tidak ada tindakan segera."

    return {
        "failure_probability": round(score, 3),
        "days_to_failure": days,
        "risk_level": risk,
        "recommendation": rec,
        "model_version": "rule-based-v1",
        "confidence": 0.65,
    }


def _risk_from_probability(prob: float) -> tuple[str, int]:
    if prob >= 0.6:
        return "high", max(1, int((1 - prob) * 14))
    if prob >= 0.3:
        return "medium", max(7, int((1 - prob) * 30))
    return "low", max(30, int((1 - prob) * 90))


def _ml_prediction(rows: list[Telemetry]) -> dict:
    """Klasifikasi kondisi per sampel dengan RandomForest lalu agregasi jadi risiko lampu."""
    model_data = joblib.load(MODEL_PATH)
    model = model_data["model"]
    feature_names = model_data["feature_names"]
    label_names = model_data.get("label_names", {0: "Normal", 1: "Perlu Perhatian", 2: "Gangguan"})

    # Urut naik berdasarkan waktu agar fitur rolling sama dengan saat training
    ordered = sorted(rows, key=lambda r: r.time)
    raw = pd.DataFrame(
        [{col: (float(v) if (v := getattr(r, col, None)) is not None else np.nan) for col in RAW_COLUMNS} for r in ordered]
    )
    X = build_features(raw)[feature_names]
    proba = model.predict_proba(X)

    classes = list(model.classes_)
    p_warning = proba[:, classes.index(1)] if 1 in classes else np.zeros(len(X))
    p_fault = proba[:, classes.index(2)] if 2 in classes else np.zeros(len(X))
    row_risk = np.clip(p_fault + 0.5 * p_warning, 0, 1)

    # Kondisi terbaru (±1 jendela rolling) lebih menentukan daripada rata-rata panjang
    prob = float(max(row_risk.mean(), row_risk[-ROLLING_WINDOW:].mean()))
    risk, days = _risk_from_probability(prob)

    predicted = model.predict(X)
    recent = predicted[-ROLLING_WINDOW:]
    dominant = int(pd.Series(recent).mode().iloc[0])
    flagged = X[predicted != 0]
    reasons = describe_issues(flagged) if len(flagged) else []
    action = "Segera lakukan inspeksi." if risk == "high" else "Pantau secara berkala." if risk == "medium" else "Kondisi baik."
    rec = f"Kondisi terkini: {label_names.get(dominant, dominant)}. Probabilitas kegagalan {prob:.0%}. {action}"
    if reasons:
        rec += " Terdeteksi: " + "; ".join(reasons) + "."

    return {
        "failure_probability": round(prob, 3),
        "days_to_failure": days,
        "risk_level": risk,
        "recommendation": rec,
        "model_version": model_data.get("version", "ml-v1"),
        "confidence": round(float(model_data.get("accuracy", 0.8)), 3),
    }


async def _run_prediction(lamp_id_str: str) -> dict:
    """Async implementation of single lamp prediction."""
    from uuid import UUID

    lamp_id = UUID(lamp_id_str)

    async with AsyncSessionLocal() as db:
        lamp = await db.get(Lamp, lamp_id)
        if not lamp or lamp.is_deleted:
            return {"error": "Lamp not found"}

        if not lamp.ml_ready:
            return {"error": "Not enough data", "telemetry_count": lamp.telemetry_count}

        rows = await _fetch_recent_rows(db, lamp_id)
        features = _extract_features(rows)
        if features is None:
            return {"error": "Could not extract features"}

        # Use ML model if available, otherwise rule-based
        result = None
        if MODEL_PATH.exists():
            try:
                result = _ml_prediction(rows)
            except Exception as e:
                logger.warning(f"ML model failed, falling back to rules: {e}")
        if result is None:
            result = _rule_based_prediction(features)

        # Save prediction
        prediction = Prediction(
            lamp_id=lamp_id,
            failure_probability=result["failure_probability"],
            days_to_failure=result["days_to_failure"],
            risk_level=result["risk_level"],
            recommendation=result["recommendation"],
            model_version=result["model_version"],
            confidence=result["confidence"],
        )
        db.add(prediction)

        # Update lamp risk level and health score
        lamp.risk_level = result["risk_level"]
        lamp.health_score = max(0, min(100, (1 - result["failure_probability"]) * 100))

        # Create alert if high risk
        if result["risk_level"] == "high":
            alert = Alert(
                lamp_id=lamp_id,
                alert_type="predictive_maintenance",
                severity="critical",
                message=f"ML prediksi risiko tinggi untuk {lamp.lamp_code}: probabilitas kegagalan {result['failure_probability']:.0%}, estimasi {result['days_to_failure']} hari",
                metric_value=result["failure_probability"],
            )
            db.add(alert)

        await db.commit()
        return result


async def _run_daily_all() -> dict:
    """Run prediction for all ml_ready lamps."""
    async with AsyncSessionLocal() as db:
        lamps = list(
            await db.scalars(
                select(Lamp).where(Lamp.is_deleted.is_(False), Lamp.ml_ready.is_(True))
            )
        )

    results = {"total": len(lamps), "success": 0, "error": 0, "high_risk": 0}

    for lamp in lamps:
        try:
            result = await _run_prediction(str(lamp.id))
            if "error" not in result:
                results["success"] += 1
                if result.get("risk_level") == "high":
                    results["high_risk"] += 1
            else:
                results["error"] += 1
        except Exception as e:
            logger.error(f"Prediction failed for {lamp.lamp_code}: {e}")
            results["error"] += 1

    return results


@celery_app.task
def run_ml_prediction(lamp_id: str) -> str:
    """Celery task: Run ML prediction for a single lamp."""
    result = asyncio.run(_run_prediction(lamp_id))
    return f"Prediction for {lamp_id}: risk={result.get('risk_level', 'error')}, prob={result.get('failure_probability', 'N/A')}"


@celery_app.task
def run_daily_ml_all_lamps() -> str:
    """Celery task: Run daily ML prediction for all ml_ready lamps."""
    result = asyncio.run(_run_daily_all())
    return f"Daily ML: {result['success']}/{result['total']} success, {result['high_risk']} high risk, {result['error']} errors"
