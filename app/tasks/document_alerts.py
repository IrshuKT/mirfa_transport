"""
Daily task: find all documents expiring within alert_days_before
and send email/SMS notifications to the company admin.
"""
from datetime import date, timedelta
from app.tasks.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.document_alerts.send_expiry_alerts")
def send_expiry_alerts():
    import asyncio
    asyncio.run(_run_expiry_alerts())


async def _run_expiry_alerts():
    from sqlalchemy import select, text
    from app.core.database import AsyncSessionLocal
    from app.models.accounting.models import EntityDocument
    from app.models.auth import Company, User, UserStatus
    from app.models.auth import RoleName
    from app.services.notification_service import notify_document_expiry

    today = date.today()

    async with AsyncSessionLocal() as db:
        # Fetch all active documents where today >= expiry_date - alert_days_before
        result = await db.execute(
            select(EntityDocument).where(
                EntityDocument.is_active == True,
                EntityDocument.expiry_date != None,
                EntityDocument.expiry_date <= today + text("alert_days_before * interval '1 day'"),
                EntityDocument.expiry_date >= today,   # not yet expired (expired handled separately)
            )
        )
        docs = result.scalars().all()
        logger.info(f"Document expiry check: {len(docs)} alerts to send")

        for doc in docs:
            days_left = (doc.expiry_date - today).days

            # Find company admin email
            admin_result = await db.execute(
                select(User).join(User.role).where(
                    User.company_id == doc.company_id,
                    User.status == UserStatus.ACTIVE,
                ).order_by(User.id).limit(1)
            )
            admin = admin_result.scalar_one_or_none()
            if not admin or not admin.email:
                continue

            await notify_document_expiry(
                to_email=admin.email,
                entity_name=f"{doc.entity_type}#{doc.entity_id}",
                doc_type=doc.doc_type,
                expiry_date=str(doc.expiry_date),
                days_remaining=days_left,
            )
