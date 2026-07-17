from typing import Annotated, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.models.accounting.models import EntityDocument
from app.utils.pagination import paginate

router = APIRouter(prefix="/documents", tags=["Documents"])
DB = Annotated[AsyncSession, Depends(get_db)]


async def _upload_to_s3(file: UploadFile, company_id: int, entity_type: str) -> str:
    """Upload file to S3/MinIO and return public URL."""
    try:
        import boto3
        from app.core.config import settings
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
            endpoint_url=settings.S3_ENDPOINT_URL or None,
        )
        key = f"{company_id}/{entity_type}/{file.filename}"
        content = await file.read()
        s3.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=content, ContentType=file.content_type)
        return f"{settings.S3_ENDPOINT_URL or 'https://s3.amazonaws.com'}/{settings.S3_BUCKET}/{key}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    db: DB,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    entity_type: str = Form(...),      # employee | vehicle | customer | vendor | company
    entity_id: int = Form(...),
    doc_type: str = Form(...),         # emirates_id | visa | passport | mulkiya | insurance | trade_license ...
    doc_no: Optional[str] = Form(None),
    issued_date: Optional[date] = Form(None),
    expiry_date: Optional[date] = Form(None),
    alert_days_before: int = Form(30),
    notes: Optional[str] = Form(None),
):
    file_url = await _upload_to_s3(file, current_user.company_id, entity_type)
    doc = EntityDocument(
        company_id=current_user.company_id,
        uploaded_by_id=current_user.id,
        entity_type=entity_type,
        entity_id=entity_id,
        doc_type=doc_type,
        doc_no=doc_no,
        file_name=file.filename,
        file_url=file_url,
        file_size_bytes=file.size,
        mime_type=file.content_type,
        issued_date=issued_date,
        expiry_date=expiry_date,
        alert_days_before=alert_days_before,
        notes=notes,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return _fmt(doc)


@router.get("")
async def list_documents(
    db: DB, current_user: CurrentUser,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    doc_type: Optional[str] = None,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
):
    q = select(EntityDocument).where(
        EntityDocument.company_id == current_user.company_id,
        EntityDocument.is_active == True,
    )
    if entity_type:
        q = q.where(EntityDocument.entity_type == entity_type)
    if entity_id:
        q = q.where(EntityDocument.entity_id == entity_id)
    if doc_type:
        q = q.where(EntityDocument.doc_type == doc_type)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(EntityDocument.expiry_date.asc().nullslast()).offset((page - 1) * page_size).limit(page_size))
    return paginate(total, page, page_size, [_fmt(d) for d in result.scalars().all()])


@router.get("/expiry-dashboard")
async def expiry_dashboard(
    db: DB, current_user: CurrentUser,
    days_ahead: int = Query(60, ge=1, le=365),
):
    from app.models.entities import Employee, Driver, Vehicle
    from sqlalchemy import literal

    cutoff = date.today() + timedelta(days=days_ahead)
    today  = date.today()

    docs = []

    # ── 1. EntityDocument table (uploaded files) ──────────────────────────
    q = select(EntityDocument).where(
        EntityDocument.company_id == current_user.company_id,
        EntityDocument.is_active  == True,
        EntityDocument.expiry_date != None,
        EntityDocument.expiry_date <= cutoff,
    )
    result = await db.execute(q)
    for doc in result.scalars().all():
        days_left = (doc.expiry_date - today).days
        docs.append({
            **_fmt(doc),
            "days_remaining": days_left,
            "urgency": _urgency(days_left),
        })

    # ── 2. Employee compliance fields ─────────────────────────────────────
    emp_result = await db.execute(
        select(Employee).where(Employee.company_id == current_user.company_id)
    )
    for emp in emp_result.scalars().all():
        for field, label in [
            ("visa_expiry",          "visa"),
            ("emirates_id_expiry",   "emirates_id"),
            ("passport_expiry",      "passport"),
            ("labour_card_expiry",   "labour_card"),
        ]:
            expiry = getattr(emp, field)
            if expiry and expiry <= cutoff:
                days_left = (expiry - today).days
                docs.append({
                    "id":            f"emp_{emp.id}_{field}",
                    "entity_type":   "employee",
                    "entity_id":     emp.id,
                    "entity_name":   emp.full_name,
                    "doc_type":      label,
                    "doc_no":        None,
                    "file_name":     None,
                    "file_url":      None,
                    "issued_date":   None,
                    "expiry_date":   expiry,
                    "alert_days_before": 30,
                    "notes":         None,
                    "created_at":    None,
                    "days_remaining": days_left,
                    "urgency":       _urgency(days_left),
                })

    # ── 3. Driver license ─────────────────────────────────────────────────
    drv_result = await db.execute(
        select(Driver).where(Driver.company_id == current_user.company_id)
    )
    for drv in drv_result.scalars().all():
        if drv.license_expiry and drv.license_expiry <= cutoff:
            days_left = (drv.license_expiry - today).days
            docs.append({
                "id":            f"drv_{drv.id}_license",
                "entity_type":   "driver",
                "entity_id":     drv.id,
                "entity_name":   drv.full_name,
                "doc_type":      "driving_license",
                "doc_no":        drv.license_no,
                "file_name":     None,
                "file_url":      None,
                "issued_date":   None,
                "expiry_date":   drv.license_expiry,
                "alert_days_before": 30,
                "notes":         None,
                "created_at":    None,
                "days_remaining": days_left,
                "urgency":       _urgency(days_left),
            })

    # ── 4. Vehicle compliance ─────────────────────────────────────────────
    veh_result = await db.execute(
        select(Vehicle).where(Vehicle.company_id == current_user.company_id)
    )
    for veh in veh_result.scalars().all():
        for field, label in [
            ("mulkiya_expiry",    "mulkiya"),
            ("insurance_expiry",  "insurance"),
            ("rta_permit_expiry", "rta_permit"),
        ]:
            expiry = getattr(veh, field)
            if expiry and expiry <= cutoff:
                days_left = (expiry - today).days
                docs.append({
                    "id":            f"veh_{veh.id}_{field}",
                    "entity_type":   "vehicle",
                    "entity_id":     veh.id,
                    "entity_name":   veh.plate_no,
                    "doc_type":      label,
                    "doc_no":        None,
                    "file_name":     None,
                    "file_url":      None,
                    "issued_date":   None,
                    "expiry_date":   expiry,
                    "alert_days_before": 30,
                    "notes":         None,
                    "created_at":    None,
                    "days_remaining": days_left,
                    "urgency":       _urgency(days_left),
                })

    # ── Sort all by expiry date ───────────────────────────────────────────
    docs.sort(key=lambda d: d["expiry_date"])

    # ── Group by entity_type ──────────────────────────────────────────────
    grouped: dict = {}
    for doc in docs:
        grouped.setdefault(doc["entity_type"], []).append(doc)

    summary = {
        "total_expiring": len(docs),
        "expired":  sum(1 for d in docs if d["days_remaining"] < 0),
        "critical": sum(1 for d in docs if 0 <= d["days_remaining"] <= 7),
        "warning":  sum(1 for d in docs if 7 < d["days_remaining"] <= 30),
        "notice":   sum(1 for d in docs if 30 < d["days_remaining"]),
    }

    return {"summary": summary, "by_entity_type": grouped}


# ── Helper ────────────────────────────────────────────────────────────────────
def _urgency(days_left: int) -> str:
    if days_left < 0:   return "expired"
    if days_left <= 7:  return "critical"
    if days_left <= 30: return "warning"
    return "notice"

@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: int, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(EntityDocument).where(
            EntityDocument.id == doc_id,
            EntityDocument.company_id == current_user.company_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.is_active = False
    await db.commit()


def _fmt(d: EntityDocument) -> dict:
    return {
        "id": d.id, "entity_type": d.entity_type, "entity_id": d.entity_id,
        "doc_type": d.doc_type, "doc_no": d.doc_no,
        "file_name": d.file_name, "file_url": d.file_url,
        "issued_date": d.issued_date, "expiry_date": d.expiry_date,
        "alert_days_before": d.alert_days_before,
        "notes": d.notes, "created_at": d.created_at,
    }
