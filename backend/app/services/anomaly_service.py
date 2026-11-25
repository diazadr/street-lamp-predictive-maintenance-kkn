"""Anomaly score of a single telemetry reading (0 = normal, 1 = clearly abnormal).

The lamp is a solar unit with a 3.2 V LiFePO4 battery on a shared bus: the bus
shows the battery voltage at night and while charging, and floats up to the
panel voltage (~7.7 V at most) once the battery is full. Units are those sent
by the firmware: V, mA, mW, lux, degC.

A single reading says little: the LED is PWM-dimmed, so one current reading is
0 or ~140 mA at random. Only signs that are abnormal on their own count here;
the hourly pju_ml assessment (app/tasks/ml_tasks.py) does the real diagnosis
over 10-minute windows. A score of 0.7 or more marks the lamp "warning".
"""

BATTERY_MAX_BUS_V = 3.70      # above this with no charging current the bus is the panel, not the battery
BATTERY_LOW_V = 3.10          # score starts rising here ...
BATTERY_CRITICAL_V = 2.90     # ... and reaches 1 here
BUS_MAX_V = 9.0               # far above any 6 V panel: wiring fault
CHARGING_MA = -10.0
DS18B20_ERRORS = (-127.0, 85.0)
BRIGHT_LUX = 5000.0
LAMP_ON_MA = 20.0
RESIDUAL_NOISE_MA = 300.0     # PWM snapshots of the branches differ by up to ~200 mA


def _clip(value: float) -> float:
    return max(0.0, min(1.0, value))


def _num(payload: dict, key: str) -> float | None:
    value = payload.get(key)
    return None if value is None else float(value)


def calculate_anomaly_score(payload: dict) -> float:
    parts: list[float] = []

    v_bus = _num(payload, "battery_voltage")
    i_batt = _num(payload, "battery_current")
    if v_bus is not None:
        charging = i_batt is not None and i_batt < CHARGING_MA
        if v_bus > BUS_MAX_V:
            parts.append(1.0)
        elif not charging and v_bus <= BATTERY_MAX_BUS_V:  # the bus is the battery
            parts.append(_clip((BATTERY_LOW_V - v_bus) / (BATTERY_LOW_V - BATTERY_CRITICAL_V)))

    temp = _num(payload, "temperature_ambient")
    if temp is None:
        temp = _num(payload, "temperature_internal")
    if temp is not None and temp in DS18B20_ERRORS:
        parts.append(0.5)  # sensor disconnected: worth a look, not a lamp fault

    lux = _num(payload, "lux")
    i_load = _num(payload, "current")
    if lux is not None and i_load is not None and lux > BRIGHT_LUX and i_load > LAMP_ON_MA:
        parts.append(0.4)  # lamp lit in full sun; repeated readings confirm it in the hourly check

    i_solar = _num(payload, "solar_current")
    if None not in (i_solar, i_batt, i_load):
        residual = abs(i_solar + i_batt - i_load)  # Kirchhoff at the shared node
        parts.append(0.6 * _clip((residual - RESIDUAL_NOISE_MA) / 700.0))

    return round(max(parts, default=0.0), 3)
