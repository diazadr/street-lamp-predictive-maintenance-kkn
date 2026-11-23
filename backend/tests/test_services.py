from app.services.anomaly_service import calculate_anomaly_score
from app.services.mqtt_service import MQTTService

# One reading at night: battery on the bus at 3.28 V feeding the LED (device units: V, mA).
NIGHT = {"battery_voltage": 3.28, "battery_current": 141.0, "solar_current": 0.0, "current": 140.0,
         "lux": 1.67, "temperature_ambient": 25.9}


def test_normal_readings_score_zero() -> None:
    assert calculate_anomaly_score(NIGHT) == 0.0
    # full battery in sun: the bus shows the panel's 7.2 V, which is normal
    assert calculate_anomaly_score({**NIGHT, "battery_voltage": 7.2, "battery_current": 0.0, "current": 0.0,
                                    "solar_current": 4.0, "lux": 30000}) == 0.0
    # charging at 1.8 A reads a high bus voltage because of the I*R drop, also normal
    assert calculate_anomaly_score({**NIGHT, "battery_voltage": 4.1, "battery_current": -1755.0,
                                    "solar_current": 1764.0, "current": 0.0, "lux": 20000}) == 0.0
    # a PWM "off" snapshot of the LED is not a fault
    assert calculate_anomaly_score({**NIGHT, "current": 0.0}) == 0.0


def test_empty_battery_marks_the_lamp() -> None:
    assert calculate_anomaly_score({**NIGHT, "battery_voltage": 0.75}) == 1.0
    assert 0 < calculate_anomaly_score({**NIGHT, "battery_voltage": 3.05}) < 0.7


def test_sensor_error_and_lamp_in_sun_do_not_mark_the_lamp_alone() -> None:
    assert calculate_anomaly_score({**NIGHT, "temperature_ambient": -127.0}) == 0.5
    sunny_lit = {**NIGHT, "battery_voltage": 7.2, "battery_current": 0.0, "lux": 30000, "solar_current": 144.0}
    assert calculate_anomaly_score(sunny_lit) == 0.4


def test_anomaly_score_stays_in_range() -> None:
    score = calculate_anomaly_score({"battery_voltage": 12.0, "battery_current": 0.0, "solar_current": 3000.0,
                                     "current": 0.0, "temperature_internal": 85.0, "lux": 0.0})
    assert 0 <= score <= 1


def test_mqtt_payload_decode_accepts_bytes() -> None:
    service = MQTTService()
    decoded = service._decode_payload(b'{"lamp_code":"SL-001","battery_level":88}')
    assert decoded["lamp_code"] == "SL-001"
    assert decoded["battery_level"] == 88
