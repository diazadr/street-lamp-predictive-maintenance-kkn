"""Training Random Forest untuk prediksi kondisi PJU.

Pemakaian (dari folder backend):

    python -m app.ml.train --data "../Dataset_PJU_ML - Sheet1.csv"

Hasil: ``ml_models/failure_predictor.joblib`` yang otomatis dipakai oleh
Celery task ``app.tasks.ml_tasks.run_ml_prediction``.
"""

from __future__ import annotations

import argparse
from datetime import UTC, datetime
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split

from app.ml.features import FEATURE_COLUMNS, LABEL_NAMES, build_features, label_condition, load_csv_dataset

DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "ml_models" / "failure_predictor.joblib"


def prepare_dataset(csv_path: str) -> tuple[pd.DataFrame, pd.Series]:
    raw = load_csv_dataset(csv_path)
    X = build_features(raw)
    y = label_condition(X)
    return X, y


def train_model(X: pd.DataFrame, y: pd.Series, random_state: int = 42) -> dict:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=random_state, stratify=y
    )
    model = RandomForestClassifier(
        n_estimators=500,
        max_depth=None,
        min_samples_split=2,
        min_samples_leaf=1,
        class_weight="balanced",
        random_state=random_state,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    labels = sorted(LABEL_NAMES)
    return {
        "model": model,
        "accuracy": accuracy_score(y_test, y_pred),
        "f1_macro": f1_score(y_test, y_pred, average="macro", labels=labels, zero_division=0),
        "report": classification_report(
            y_test, y_pred, labels=labels, target_names=[LABEL_NAMES[i] for i in labels], zero_division=0
        ),
        "confusion_matrix": confusion_matrix(y_test, y_pred, labels=labels),
        "feature_importance": pd.Series(model.feature_importances_, index=X.columns).sort_values(ascending=False),
        "n_train": len(X_train),
        "n_test": len(X_test),
    }


def save_model(result: dict, output: Path, class_counts: dict) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": result["model"],
            "feature_names": FEATURE_COLUMNS,
            "label_names": LABEL_NAMES,
            "model_type": "condition_classifier",
            "version": f"rf-condition-{datetime.now(UTC):%Y%m%d}",
            "accuracy": float(result["accuracy"]),
            "f1_macro": float(result["f1_macro"]),
            "class_counts": class_counts,
            "trained_at": datetime.now(UTC).isoformat(),
        },
        output,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Random Forest PJU predictive maintenance")
    parser.add_argument("--data", required=True, help="Path CSV dataset perangkat")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Path file .joblib hasil")
    args = parser.parse_args()

    X, y = prepare_dataset(args.data)
    counts = {LABEL_NAMES[k]: int(v) for k, v in y.value_counts().sort_index().items()}
    print(f"Jumlah sampel: {len(X)}  | Distribusi label: {counts}")

    result = train_model(X, y)
    print(f"\nAccuracy : {result['accuracy']:.4f}")
    print(f"F1 macro : {result['f1_macro']:.4f}\n")
    print(result["report"])
    print("Confusion matrix (baris=aktual, kolom=prediksi):")
    print(result["confusion_matrix"])
    print("\nFeature importance:")
    print(result["feature_importance"].round(4).to_string())

    save_model(result, Path(args.output), counts)
    print(f"\nModel disimpan ke {args.output}")


if __name__ == "__main__":
    main()
