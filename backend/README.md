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

## Machine Learning (predictive maintenance)

Penilaian kondisi lampu memakai paket **`pju_ml`** (folder `backend/pju_ml`, sumber: proyek KKN `pju-ml`). Celery task `run_ml_all_lamps` (tiap jam) mengambil telemetry 72 jam terakhir tiap lampu, lalu menjalankan tiga bagian:

1. **Mesin aturan fisika + baseline perilaku normal.** Mendeteksi lampu tidak menyala, LED meredup, lampu menyala siang hari, baterai lemah/kritis, baterai tidak pernah penuh, tidak ada pengisian, panel kotor, dan sensor bermasalah. Ambangnya konservatif: tidak ada alarm palsu pada data rekaman.
2. **Model baterai (coulomb counting).** Menghitung % baterai, cadangan tanpa matahari (malam), dan sisa hari sampai habis bila baterai berhari-hari tidak terisi penuh.
3. **Random Forest pengklasifikasi kondisi** (`ml_models/condition_rf.joblib`). Memberi peringatan tambahan untuk pola yang lolos dari aturan, tetapi tidak pernah menimpa temuan aturan.

Hasil disimpan ke `predictions` (6 kolom lama + JSON `details`), `lamps.health_score`, `lamps.risk_level`, dan `lamps.last_battery_level` (estimasi, karena firmware tidak mengirim level baterai). Alert dibuat untuk temuan *warning/critical* baru (`alert_type` = `pm_<kode>`), tidak berulang selama alert sejenis belum diselesaikan.

```bash
# dari folder backend; gunakan scikit-learn sesuai requirements.txt
python -m app.ml.train --data "../Dataset_PJU_ML - Sheet1.csv"
# -> ml_models/baseline.json, ml_models/condition_rf.joblib, ml_models/model_card.json
```

**Cara melatih Random Forest.** Data rekaman tidak memuat kejadian rusak, dan label dari ambang aturan hanya akan membuat model meniru aturan itu. Karena itu jendela 10 menit dari data asli dipakai sebagai contoh *normal*, lalu salinan data asli diberi **gangguan simulasi sesuai fisika perangkat** (*fault injection*) dengan tingkat keparahan acak. Validasi dilakukan **per hari rekaman**: latih di satu hari, uji di hari lain.

| Leave-one-day-out (2.720 jendela) | Random Forest | Aturan |
|---|---|---|
| Akurasi | 0,944 | 0,694 |
| F1-makro | 0,905 | 0,690 |
| Alarm palsu pada jendela normal | 3,1% | 0% |

Rincian per kelas ada di `ml_models/model_card.json`.

**Catatan data & perangkat**

- Satuan telemetry mengikuti firmware: **V, mA, mW**, lux, °C. `pju_ml` mengonversi ke A/W sendiri.
- Firmware boleh mengirim kolom logger apa adanya (`V1_Solar`, `I2_Batt`, `Temp_C`, `Timestamp` = `dd/mm/yyyy HH:MM:SS` WIB). `TelemetryCreate` memetakannya otomatis.
- Ketiga INA219 berada di satu titik positif bersama, jadi `battery_voltage` adalah **tegangan bus**: tegangan baterai saat malam/mengisi, tegangan panel (±7,2 V) saat baterai penuh.
- Spesifikasi produk: LiFePO4 5 Ah (16 Wh), panel 6 V 8 W, lampu varian 90 W. Isi `lamps.battery_capacity_wh` per lampu. Kosong = 16 Wh.
- Ambang alert dan `anomaly_service` disesuaikan untuk sistem DC 3,2–7,7 V. Migrasi `0003` mengubah ambang AC bawaan (190 V dst.) bila belum pernah diedit admin.
- `ml_ready` aktif setelah 260 data (±1 jam pada sampling ±14 detik).
- Notebook `notebooks/PJU Predictive Maintenance Random Forest.ipynb` adalah **arsip** pipeline RF lama (label aturan per sampel) dan memakai `notebooks/legacy_rf_features.py`.
- Latih ulang setelah ada data lebih panjang dan riwayat `repair_tickets`, supaya model belajar dari kerusakan nyata.
