"""
Daily task: find overdue invoices and email customers.
Runs at 9 AM Dubai time via Celery beat.
"""
from datetime import date
from app.tasks.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.invoice_reminders.send_overdue_reminders")
def send_overdue_reminders():
    import asyncio
    asyncio.run(_run_overdue_reminders())


async def _run_overdue_reminders():
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.accounting.models import Invoice, InvoiceStatus
    from app.models.entities import Customer
    from app.services.notification_service import notify_invoice_overdue

    today = date.today()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Invoice).where(
                Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID]),
                Invoice.due_date < today,
                Invoice.balance_due > 0,
            )
        )
        invoices = result.scalars().all()
        logger.info(f"Overdue invoice check: {len(invoices)} invoices to chase")

        for inv in invoices:
            days_overdue = (today - inv.due_date).days

            # Get customer email
            customer = await db.get(Customer, inv.customer_id)
            if not customer or not customer.email:
                continue

            # Mark as overdue
            inv.status = InvoiceStatus.OVERDUE

            await notify_invoice_overdue(
                customer_email=customer.email,
                invoice_no=inv.invoice_no,
                balance_due=float(inv.balance_due),
                days_overdue=days_overdue,
            )

        await db.commit()
