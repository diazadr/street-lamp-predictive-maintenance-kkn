"""Canonical telemetry schema shared by training and the backend.

Column names follow the backend's ``Telemetry`` model
(street-lamp-predictive-maintenance-kkn/backend/app/models). Units are SI:
volts, amperes, watts, lux, degrees Celsius.

Battery current sign convention (confirmed by the hardware team):
    negative = battery is charging, positive = battery is discharging.

Hardware (hardware team, 23 Nov 2026): integrated solar street light with a
built-in charge controller, LiFePO4 pack, 6 V panel and an SMD5730 LED board
dimmed by PWM with a motion sensor. The three INA219 are high-side on the
branches of one common positive node, so their voltages are the same bus
voltage (see ``pju_ml.battery``). Logger units: V, mA, mW; power values are
read from the INA219 power register.
"""

# Product specification (seller listing). Team decision of 23 Nov 2026: follow
# the product listing; the unit is the 90 W variant.
PRODUCT = {
    "name": "Lampu jalan solar terintegrasi, varian 90 W",
    # Listed rating of the variant. The LED board actually draws far less:
    # ~0.46 W median, 2.3 W peak in the 22-24 Oct 2026 data.
    "lamp_power_rating_w": 90.0,
    "panel_wp": 8.0,
    "panel_nominal_v": 6.0,
    "battery_chemistry": "LiFePO4",
    "battery_nominal_v": 3.2,
    "battery_capacity_ah": 5.0,
}

TIME = "time"

SOLAR_VOLTAGE = "solar_voltage"
SOLAR_CURRENT = "solar_current"
SOLAR_POWER = "solar_power"
BATTERY_VOLTAGE = "battery_voltage"
BATTERY_CURRENT = "battery_current"
BATTERY_POWER = "battery_power"  # not stored by the backend; kept for analysis only
LOAD_VOLTAGE = "voltage"
LOAD_CURRENT = "current"
LOAD_POWER = "power"
LUX = "lux"
# DS18B20 hangs in open air (hardware team), so it is ambient temperature.
TEMPERATURE = "temperature_ambient"

SENSOR_COLUMNS = [
    SOLAR_VOLTAGE, SOLAR_CURRENT, SOLAR_POWER,
    BATTERY_VOLTAGE, BATTERY_CURRENT, BATTERY_POWER,
    LOAD_VOLTAGE, LOAD_CURRENT, LOAD_POWER,
    LUX, TEMPERATURE,
]
CURRENT_COLUMNS = [SOLAR_CURRENT, BATTERY_CURRENT, LOAD_CURRENT]
POWER_COLUMNS = [SOLAR_POWER, BATTERY_POWER, LOAD_POWER]

# Raw dataset column -> (canonical column, multiplier to SI units)
RAW_COLUMN_MAP = {
    "V1_Solar": (SOLAR_VOLTAGE, 1.0),
    "I1_Solar": (SOLAR_CURRENT, 1e-3),  # mA -> A
    "P1_Solar": (SOLAR_POWER, 1e-3),    # mW -> W
    "V2_Batt": (BATTERY_VOLTAGE, 1.0),
    "I2_Batt": (BATTERY_CURRENT, 1e-3),
    "P2_Batt": (BATTERY_POWER, 1e-3),
    "V3_Load": (LOAD_VOLTAGE, 1.0),
    "I3_Load": (LOAD_CURRENT, 1e-3),
    "P3_Load": (LOAD_POWER, 1e-3),
    "Lux": (LUX, 1.0),
    "Temp_C": (TEMPERATURE, 1.0),
}
RAW_TIME_COLUMN = "Timestamp"

# Device clock is local time (WIB). Stored timestamps are made timezone-aware.
LOCAL_TZ = "Asia/Jakarta"

# Light levels (BH1750 faces up and does not see the lamp itself).
NIGHT_LUX = 20.0       # below this it is dark
DAYLIGHT_LUX = 200.0   # above this it is day
BRIGHT_LUX = 5000.0    # enough sun to charge properly

# Plausible physical ranges (SI units). Values outside become NaN.
# Wide on purpose: they catch sensor garbage, not faults.
VALID_RANGES = {
    SOLAR_VOLTAGE: (0.0, 30.0),
    BATTERY_VOLTAGE: (0.0, 30.0),
    LOAD_VOLTAGE: (0.0, 30.0),
    SOLAR_CURRENT: (-0.5, 5.0),
    BATTERY_CURRENT: (-5.0, 5.0),
    LOAD_CURRENT: (-0.5, 5.0),
    SOLAR_POWER: (0.0, 100.0),
    BATTERY_POWER: (0.0, 100.0),
    LOAD_POWER: (0.0, 100.0),
    LUX: (0.0, 150_000.0),
    TEMPERATURE: (-20.0, 80.0),
}

# DS18B20 special readings: -127 = sensor disconnected, 85 = power-on reset value.
DS18B20_ERROR_VALUES = (-127.0, 85.0)
