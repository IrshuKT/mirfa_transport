from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "logistics",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.document_alerts",
        "app.tasks.invoice_reminders",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Dubai",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
)

# ── Scheduled tasks (beat) ────────────────────────────────────────────────────
celery_app.conf.beat_schedule = {
    # Every morning at 8 AM Dubai time — check expiring documents
    "daily-document-expiry-alerts": {
        "task": "app.tasks.document_alerts.send_expiry_alerts",
        "schedule": crontab(hour=8, minute=0),
    },
    # Every morning at 9 AM — chase overdue invoices
    "daily-invoice-reminders": {
        "task": "app.tasks.invoice_reminders.send_overdue_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
}
