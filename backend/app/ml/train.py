"""Train the PJU predictive-maintenance models.

Pemakaian (dari folder backend):

    python -m app.ml.train --data "../Dataset_PJU_ML - Sheet1.csv"

Menghasilkan di ``ml_models/``:

* ``baseline.json``        perilaku normal lampu (arus LED, daya panel per lux, duty PWM)
* ``condition_rf.joblib``  Random Forest pengklasifikasi kondisi (normal + 7 jenis gangguan)
* ``model_card.json``      data, metode, dan hasil evaluasi leave-one-day-out

Dataset mentah tidak punya kejadian rusak, jadi Random Forest dilatih dari data asli
(label normal) ditambah salinan data asli yang diberi gangguan simulasi sesuai fisika
perangkat (fault injection). Validasi: latih di satu hari rekaman, uji di hari lain.
Jalankan dengan scikit-learn versi yang sama dengan ``requirements.txt``.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pju_ml.cleaning import clean_file, drop_short_segments
from pju_ml.features import build_features
from pju_ml.predictor import Baseline
from pju_ml.training import evaluate_by_day, make_training_set, model_card, train_condition_model

from app.ml.engine import BASELINE_PATH, CONDITION_MODEL_PATH, MODEL_DIR


def main() -> None:
    parser = argparse.ArgumentParser(description="Train PJU predictive-maintenance models")
    parser.add_argument("--data", required=True, help="Path dataset perangkat (.csv atau .xlsx)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    clean, report = clean_file(args.data)
    usable = drop_short_segments(clean)
    print(f"Data: {len(usable)} bacaan dipakai dari {report.rows_in} "
          f"({report.suspect_synthetic_rows} baris non-sensor dibuang)")

    baseline = Baseline.fit(build_features(usable), source=Path(args.data).name)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    baseline.save(BASELINE_PATH)
    print(f"Baseline: {baseline}")

    data = make_training_set(usable, seed=args.seed)
    print(f"Jendela berlabel: {len(data)} {data['label'].value_counts().to_dict()}")
    evaluation = evaluate_by_day(data, lambda normal: Baseline.fit(normal), seed=args.seed)
    for name in ("random_forest", "rules"):
        s = evaluation[name]
        print(f"{name:14s} akurasi {s['accuracy']:.3f}  F1-makro {s['f1_macro']:.3f}  "
              f"alarm palsu {s['false_alarm_rate']:.1%}")

    source = f"{Path(args.data).name}: {len(usable)} bacaan"
    model = train_condition_model(data, evaluation=evaluation, seed=args.seed, training_data=source)
    model.save(CONDITION_MODEL_PATH)
    card = model_card(model)
    (MODEL_DIR / "model_card.json").write_text(json.dumps(card, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Model disimpan: {CONDITION_MODEL_PATH} (scikit-learn {model.sklearn_version})")


if __name__ == "__main__":
    main()
