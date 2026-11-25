from celery import Celery

from app.core.config import get_settings


settings = get_settings()
celery_app = Celery("pju_backend", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.beat_schedule = {
    "check-offline": {"task": "app.tasks.lamp_tasks.check_offline_lamps", "schedule": 300.0},
    # Hourly: the battery estimate (charge level, autonomy) changes through the night.
    "hourly-ml": {"task": "app.tasks.ml_tasks.run_ml_all_lamps", "schedule": 3600.0},
    "daily-backup": {"task": "app.tasks.backup_tasks.run_database_backup", "schedule": 86400.0},
}
