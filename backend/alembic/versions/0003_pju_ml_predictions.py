"""prediction details + alert thresholds for the 3.3-7.2 V DC solar lamp

Revision ID: 0003_pju_ml_predictions
Revises: 0002_indexes_hypertable
Create Date: 2026-11-23

* ``predictions.details`` (JSONB) keeps the full pju_ml assessment: health score,
  component health, issues, battery estimate, lamp activity, Random Forest verdict.
* The thresholds seeded by 0001 assume a 220 V AC lamp and fire on every reading of
  this DC system. Rows still holding those original values are switched to DC
  values in device units (V, mA); rows an admin already edited are left alone.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003_pju_ml_predictions"
down_revision = "0002_indexes_hypertable"
branch_labels = None
depends_on = None

# (name, metric, condition, warning, critical): original AC row -> DC row
THRESHOLD_CHANGES = [
    (("Tegangan rendah", "voltage", "lt", 190.0, 180.0),
     ("Tegangan baterai rendah", "battery_voltage", "lt", 3.0, 2.8)),
    (("Tegangan tinggi", "voltage", "gt", 240.0, 250.0),
     ("Tegangan bus tinggi", "battery_voltage", "gt", 8.5, 9.5)),
    (("Arus berlebih", "current", "gt", 5.0, 7.0),
     ("Arus lampu berlebih", "current", "gt", 1000.0, 1500.0)),
]


def _swap(old: tuple, new: tuple) -> None:
    op.execute(
        sa.text(
            "UPDATE alert_thresholds SET name = :new_name, metric = :new_metric, condition = :new_cond, "
            "warning_value = :new_warn, critical_value = :new_crit "
            "WHERE metric = :old_metric AND condition = :old_cond "
            "AND warning_value = :old_warn AND critical_value = :old_crit"
        ).bindparams(
            new_name=new[0], new_metric=new[1], new_cond=new[2], new_warn=new[3], new_crit=new[4],
            old_metric=old[1], old_cond=old[2], old_warn=old[3], old_crit=old[4],
        )
    )


def upgrade() -> None:
    op.add_column("predictions", sa.Column("details", postgresql.JSONB(), nullable=True))
    for old, new in THRESHOLD_CHANGES:
        _swap(old, new)


def downgrade() -> None:
    for old, new in THRESHOLD_CHANGES:
        _swap(new, old)
    op.drop_column("predictions", "details")
