"""Shared feature engineering for the PJU Random Forest model.

Dipakai oleh script training (dataset CSV dari perangkat) DAN oleh Celery task
(baris tabel ``telemetry``), sehingga fitur saat training dan saat prediksi
dijamin identik.

Satuan mengikuti firmware/dataset: tegangan dalam Volt, arus dalam mA,
daya dalam mW, cahaya dalam lux, suhu dalam °C.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Kolom CSV dataset perangkat -> nama kolom tabel `telemetry`
CSV_COLUMN_MAP = {
    "V1_Solar": "solar_voltage",
    "I1_Solar": "solar_current",
    "P1_Solar": "solar_power",
    "V2_Batt": "battery_voltage",
    "I2_Batt": "battery_current",
    "V3_Load": "voltage",
    "I3_Load": "current",
    "P3_Load": "power",
    "Lux": "lux",
    "Temp_C": "temperature_internal",
}

RAW_COLUMNS = list(CSV_COLUMN_MAP.values())

# Ambang batas domain (dipakai untuk fitur turunan & pelabelan)
NIGHT_LUX = 50.0             # di bawah ini dianggap malam -> lampu seharusnya menyala
LOAD_ON_MA = 5.0             # arus beban > 5 mA = lampu menyala
SENSOR_ERROR_TEMP = -50.0    # DS18B20 mengirim -127 saat sensor terputus
OVERHEAT_TEMP = 40.0
BATT_DEAD_V = 2.5            # baterai terputus / habis total
BATT_LOW_V = 3.2             # baterai Li-ion rendah
ROLLING_WINDOW = 20          # ~5 menit pada interval sampling ±14 detik

LABEL_NAMES = {0: "Normal", 1: "Perlu Perhatian", 2: "Gangguan"}

FEATURE_COLUMNS = RAW_COLUMNS + [
    "is_night",
    "load_on",
    "lamp_on_ratio_night",
    "load_current_mean",
    "battery_voltage_mean",
    "battery_voltage_min",
    "temperature_max",
    "solar_power_mean",
]


def load_csv_dataset(path: str) -> pd.DataFrame:
    """Baca CSV dari perangkat dan ubah ke nama kolom tabel telemetry."""
    df = pd.read_csv(path)
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    df["time"] = pd.to_datetime(df["Timestamp"], dayfirst=True)
    df = df.rename(columns=CSV_COLUMN_MAP)
    return df[["time", *RAW_COLUMNS]].sort_values("time").reset_index(drop=True)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Bangun matriks fitur dari data telemetry yang terurut naik berdasarkan waktu.

    ``df`` minimal berisi kolom ``RAW_COLUMNS``; nilai kosong diisi dengan
    nilai sebelumnya (lalu 0) agar model tetap bisa memprediksi.
    """
    data = df.reindex(columns=RAW_COLUMNS).astype(float).ffill().fillna(0.0)
    win = data.rolling(ROLLING_WINDOW, min_periods=1)

    out = data.copy()
    out["is_night"] = (data["lux"] < NIGHT_LUX).astype(int)
    out["load_on"] = (data["current"] > LOAD_ON_MA).astype(int)

    # Rasio lampu menyala hanya dihitung pada sampel malam; siang hari = 1 (tidak relevan)
    night_on = (out["load_on"] * out["is_night"]).rolling(ROLLING_WINDOW, min_periods=1).sum()
    night_cnt = out["is_night"].rolling(ROLLING_WINDOW, min_periods=1).sum()
    out["lamp_on_ratio_night"] = np.where(night_cnt > 0, night_on / night_cnt.replace(0, 1), 1.0)

    out["load_current_mean"] = win["current"].mean()
    out["battery_voltage_mean"] = win["battery_voltage"].mean()
    out["battery_voltage_min"] = win["battery_voltage"].min()
    out["temperature_max"] = win["temperature_internal"].max()
    out["solar_power_mean"] = win["solar_power"].mean()

    return out[FEATURE_COLUMNS]


def label_condition(features: pd.DataFrame) -> pd.Series:
    """Label kondisi berbasis aturan domain (dataset mentah tidak punya label).

    0 = Normal, 1 = Perlu Perhatian, 2 = Gangguan.
    """
    f = features
    fault = (
        (f["battery_voltage"] < BATT_DEAD_V)
        | (f["temperature_internal"] < SENSOR_ERROR_TEMP)
        # Malam pekat, baterai masih cukup, tapi lampu mati sepanjang jendela
        | ((f["lux"] < 5) & (f["lamp_on_ratio_night"] == 0) & (f["battery_voltage"] >= BATT_LOW_V))
    )
    warning = (
        ((f["battery_voltage"] >= BATT_DEAD_V) & (f["battery_voltage"] < BATT_LOW_V))
        | (f["temperature_internal"] > OVERHEAT_TEMP)
        # Lampu tidak stabil / sering mati di malam hari
        | ((f["is_night"] == 1) & (f["lamp_on_ratio_night"] < 0.5))
    )
    label = pd.Series(0, index=f.index, dtype=int)
    label[warning] = 1
    label[fault] = 2
    return label


def describe_issues(features: pd.DataFrame) -> list[str]:
    """Daftar penyebab yang terdeteksi, untuk teks rekomendasi."""
    f = features
    reasons = []
    if (f["battery_voltage"] < BATT_DEAD_V).any():
        reasons.append("Tegangan baterai drop/terputus")
    elif (f["battery_voltage"] < BATT_LOW_V).any():
        reasons.append("Tegangan baterai rendah")
    if (f["temperature_internal"] < SENSOR_ERROR_TEMP).any():
        reasons.append("Sensor suhu error/terputus")
    if (f["temperature_internal"] > OVERHEAT_TEMP).any():
        reasons.append("Suhu perangkat tinggi")
    night = f[f["is_night"] == 1]
    if len(night) and (night["lamp_on_ratio_night"] < 0.5).any():
        reasons.append("Lampu sering mati di malam hari")
    return reasons
