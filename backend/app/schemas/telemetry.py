from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from pydantic import model_validator

from app.schemas.common import ORMModel

# Column names of the ESP32 data logger (Dataset_PJU_ML) -> telemetry fields.
# Units stay as the device sends them: V, mA, mW, lux, degC.
LOGGER_KEYS = {
    "Timestamp": "timestamp",
    "V1_Solar": "solar_voltage",
    "I1_Solar": "solar_current",
    "P1_Solar": "solar_power",
    "V2_Batt": "battery_voltage",
    "I2_Batt": "battery_current",
    "V3_Load": "voltage",
    "I3_Load": "current",
    "P3_Load": "power",
    "Lux": "lux",
    "Temp_C": "temperature_ambient",  # DS18B20 hangs in open air
}
WIB = timezone(timedelta(hours=7))


def _logger_timestamp(value: Any) -> Any:
    """Logger time ``22/10/2026 8:04:55`` (local WIB) -> aware datetime; other values unchanged."""
    if isinstance(value, str):
        try:
            return datetime.strptime(value.strip(), "%d/%m/%Y %H:%M:%S").replace(tzinfo=WIB)
        except ValueError:
            return value
    return value


class TelemetryCreate(ORMModel):
    lamp_code: str | None = None
    timestamp: datetime | None = None
    voltage: float | None = None
    current: float | None = None
    power: float | None = None
    energy: float | None = None
    solar_voltage: float | None = None
    solar_current: float | None = None
    solar_power: float | None = None
    solar_energy_today: float | None = None
    battery_level: float | None = None
    battery_voltage: float | None = None
    battery_current: float | None = None
    temperature_internal: float | None = None
    temperature_ambient: float | None = None
    lux: float | None = None
    motion_count: int = 0
    signal_strength: float | None = None
    mqtt_latency_ms: int | None = None
    brightness: float | None = None

    @model_validator(mode="before")
    @classmethod
    def _accept_logger_format(cls, data: Any) -> Any:
        """Accept the data logger's own column names, so firmware can publish rows as logged."""
        if isinstance(data, dict) and any(key in data for key in LOGGER_KEYS):
            data = {LOGGER_KEYS.get(key, key): value for key, value in data.items()}
            data["timestamp"] = _logger_timestamp(data.get("timestamp"))
        return data


class TelemetryRead(TelemetryCreate):
    id: int
    lamp_id: UUID
    time: datetime
    anomaly_score: float | None = None
