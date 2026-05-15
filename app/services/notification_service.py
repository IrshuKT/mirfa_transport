"""
Notification service — Firebase push, Twilio SMS, SendGrid email.
All methods are fire-and-forget; errors are logged, not raised.
"""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Email (SendGrid) ──────────────────────────────────────────────────────────

async def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    from_email: Optional[str] = None,
) -> bool:
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        message = Mail(
            from_email=from_email or settings.DEFAULT_FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=html_body,
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info(f"Email sent to {to_email}: {response.status_code}")
        return response.status_code in (200, 202)
    except Exception as e:
        logger.error(f"Email send failed to {to_email}: {e}")
        return False


# ── SMS (Twilio) ──────────────────────────────────────────────────────────────

async def send_sms(to_number: str, body: str) -> bool:
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            body=body,
            from_=settings.TWILIO_FROM_NUMBER,
            to=to_number,
        )
        logger.info(f"SMS sent to {to_number}: {message.sid}")
        return True
    except Exception as e:
        logger.error(f"SMS send failed to {to_number}: {e}")
        return False


# ── Firebase Push (FCM) ───────────────────────────────────────────────────────

async def send_push(
    fcm_token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> bool:
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        if not firebase_admin._apps:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_JSON)
            firebase_admin.initialize_app(cred)

        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={str(k): str(v) for k, v in (data or {}).items()},
            token=fcm_token,
        )
        response = messaging.send(message)
        logger.info(f"Push sent: {response}")
        return True
    except Exception as e:
        logger.error(f"Push notification failed: {e}")
        return False


# ── High-level notification helpers ──────────────────────────────────────────

async def notify_driver_new_job(
    driver_mobile: str,
    driver_fcm_token: Optional[str],
    job_no: str,
    pickup_address: str,
) -> None:
    body = f"New job {job_no} assigned. Pickup: {pickup_address}"
    await send_sms(driver_mobile, body)
    if driver_fcm_token:
        await send_push(
            driver_fcm_token,
            title="New Job Assigned",
            body=body,
            data={"job_no": job_no, "type": "new_job"},
        )


async def notify_customer_job_delivered(
    customer_email: str,
    job_no: str,
    tracking_token: str,
) -> None:
    html = f"""
    <h2>Your delivery is complete</h2>
    <p>Job <strong>{job_no}</strong> has been delivered successfully.</p>
    <p><a href="https://app.mirfatransport.ae/track/{tracking_token}">View POD & details</a></p>
    """
    await send_email(customer_email, f"Delivery Complete — {job_no}", html)


async def notify_document_expiry(
    to_email: str,
    entity_name: str,
    doc_type: str,
    expiry_date: str,
    days_remaining: int,
) -> None:
    urgency = "URGENT" if days_remaining <= 7 else "Action Required"
    html = f"""
    <h2>[{urgency}] Document Expiry Alert</h2>
    <p>The following document is expiring soon:</p>
    <ul>
        <li><strong>Entity:</strong> {entity_name}</li>
        <li><strong>Document:</strong> {doc_type}</li>
        <li><strong>Expiry Date:</strong> {expiry_date}</li>
        <li><strong>Days Remaining:</strong> {days_remaining}</li>
    </ul>
    <p>Please renew this document before it expires.</p>
    """
    await send_email(
        to_email,
        f"[{urgency}] {doc_type} expiring in {days_remaining} days — {entity_name}",
        html,
    )


async def notify_invoice_overdue(
    customer_email: str,
    invoice_no: str,
    balance_due: float,
    days_overdue: int,
) -> None:
    html = f"""
    <h2>Invoice Overdue — Action Required</h2>
    <p>Invoice <strong>{invoice_no}</strong> is {days_overdue} days overdue.</p>
    <p>Outstanding balance: <strong>AED {balance_due:,.2f}</strong></p>
    <p>Please arrange payment at your earliest convenience.</p>
    """
    await send_email(
        customer_email,
        f"Overdue Invoice {invoice_no} — AED {balance_due:,.2f}",
        html,
    )
