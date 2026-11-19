# Backend PJU IoT Monitoring

Backend FastAPI ini mengikuti `srs_v4.md` untuk modul inti: auth JWT + refresh cookie, user approval, lamp/place management, telemetry ingestion, alert threshold, MQTT command publisher, websocket realtime, monitoring KPI, energy, ticket repair, report job skeleton, Celery task skeleton, dan Alembic migration.

## Jalankan Lokal

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.scripts.seed
uvicorn app.main:app --reload
```

Dokumentasi API tersedia di `http://localhost:8000/docs`.

## Jalankan dengan Podman/Docker Compose

```bash
cd backend
cp .env.example .env
podman compose up --build
```

Setelah database sehat, jalankan migrasi dan seed dari container backend:

```bash
podman compose exec backend alembic upgrade head
podman compose exec backend python -m app.scripts.seed
```

## Catatan

MQTT dan Celery sudah disiapkan sebagai service/task skeleton. API tetap dapat berjalan tanpa broker MQTT aktif; publish command akan dicatat di log dan mengembalikan `published=false`.

## Machine Learning (Random Forest)

Model mengklasifikasikan kondisi tiap sampel telemetry menjadi **Normal / Perlu Perhatian / Gangguan**, lalu Celery task `run_ml_prediction` mengagregasinya menjadi `risk_level` lampu.

```bash
# dari folder backend
python -m app.ml.train --data "../Dataset_PJU_ML - Sheet1.csv"
# -> ml_models/failure_predictor.joblib (otomatis dipakai task; tanpa file ini task memakai rule-based)
```

- Fitur & pelabelan: `app/ml/features.py` (dipakai saat training dan prediksi).
- Notebook eksplorasi: `notebooks/PJU Predictive Maintenance Random Forest.ipynb` (butuh `matplotlib`, `seaborn`, `jupyter`).
- Satuan telemetry mengikuti firmware: V, mA, mW, lux, °C.
- Label saat ini dibuat dari aturan domain karena dataset belum berlabel; ganti dengan riwayat tiket kerusakan agar model benar-benar prediktif.
