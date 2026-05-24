"""Jobs router — request → job → dispatch → POD."""
import secrets
from typing import Annotated, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, DispatcherRequired, DriverRequired
from app.models.auth import User
from app.models.job import Dispatch, DispatchStatus, Job, JobStatus, ServiceRequest
from app.models.entities import Customer
import os, shutil
from fastapi import File, UploadFile

router = APIRouter(prefix="/jobs", tags=["Jobs"])
DB = Annotated[AsyncSession, Depends(get_db)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    customer_id: int
    pickup_address: str
    delivery_address: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    scheduled_pickup_at: Optional[datetime] = None
    scheduled_delivery_at: Optional[datetime] = None
    agreed_amount: Optional[float] = None
    notes: Optional[str] = None
    priority: str = "normal"
    service_request_id: Optional[int] = None
    assigned_to_id: Optional[int] = None

class JobUpdate(BaseModel):
    pickup_address: Optional[str] = None
    delivery_address: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    scheduled_pickup_at: Optional[datetime] = None
    scheduled_delivery_at: Optional[datetime] = None
    agreed_amount: Optional[float] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    priority: Optional[str] = None
    customer_id: Optional[int] = None
    assigned_to_id: Optional[int] = None

class JobDocumentOut(BaseModel):
    id: int
    job_id: int
    doc_type: str
    file_name: str
    file_url: str
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    notes: Optional[str] = None
    uploaded_by_id: int

class DispatchCreate(BaseModel):
    driver_id: int
    vehicle_id: Optional[int] = None

class PODUpdate(BaseModel):
    pod_signature_url: Optional[str] = None
    pod_photo_url: Optional[str] = None
    pod_notes: Optional[str] = None
    pod_received_by: Optional[str] = None

class LocationPing(BaseModel):
    lat: float
    lng: float
    accuracy_m: Optional[float] = None
    speed_kmh: Optional[float] = None
    heading: Optional[float] = None
    job_id: Optional[int] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_or_404(job_id: int, db: AsyncSession) -> Job:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _assert_company(user: User, job: Job):
    if user.role.name != "super_admin" and user.company_id != job.company_id:
        raise HTTPException(status_code=403, detail="Access denied")


async def _get_portal_customer(user: User, db: AsyncSession) -> Optional[Customer]:
    """Return the Customer linked to a customer_portal user, or None."""
    result = await db.execute(
        select(Customer).where(Customer.portal_user_id == user.id)
    )
    return result.scalar_one_or_none()


def _job_dict(job: Job) -> dict:
    return {
        "id": job.id,
        "job_no": job.job_no,
        "status": job.status,
        "priority": job.priority,
        "customer_id": job.customer_id,
        "pickup_address": job.pickup_address,
        "delivery_address": job.delivery_address,
        "scheduled_pickup_at": job.scheduled_pickup_at,
        "scheduled_delivery_at": job.scheduled_delivery_at,
        "actual_pickup_at": job.actual_pickup_at,
        "actual_delivery_at": job.actual_delivery_at,
        "agreed_amount": float(job.agreed_amount) if job.agreed_amount else None,
        "currency": job.currency,
        "is_invoiced": job.is_invoiced,
        "tracking_token": job.tracking_token,
        "notes": job.notes,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "assigned_to_id": job.assigned_to_id,
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=dict)
async def list_jobs(
    db: DB,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    search: Optional[str] = None,
    assigned_to_id: Optional[int] = None,
):
    q = select(Job).where(Job.company_id == current_user.company_id)

    # ── Portal users: scope to their customer only ────────────────────────────
    if current_user.role.name == "customer_portal":
        portal_customer = await _get_portal_customer(current_user, db)
        if not portal_customer:
            # No linked customer → return empty
            return {"total": 0, "page": page, "page_size": page_size, "pages": 1, "results": []}
        q = q.where(Job.customer_id == portal_customer.id)

    # ── Drivers: only their dispatched jobs ───────────────────────────────────
    elif current_user.role.name == "driver":
        q = (
            select(Job)
            .join(Dispatch, Dispatch.job_id == Job.id)
            .where(
                Job.company_id == current_user.company_id,
                Dispatch.driver_id == current_user.id,
            )
        )

    # ── Optional filters (apply after role scoping) ───────────────────────────
    if assigned_to_id:
        q = q.where(Job.assigned_to_id == assigned_to_id)
    if status_filter:
        q = q.where(Job.status == status_filter)
    if customer_id and current_user.role.name != "customer_portal":
        # Don't allow portal users to override their scoped customer_id
        q = q.where(Job.customer_id == customer_id)
    if search:
        q = q.where(Job.job_no.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(
        q.order_by(Job.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    jobs = result.scalars().all()
    pages = max(1, -(-total // page_size))  # ceiling division

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "results": [_job_dict(j) for j in jobs],
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_job(
    request: Request,
    payload: JobCreate,
    db: DB,
    current_user: CurrentUser,
):
    # Portal users: force customer_id to their own — ignore whatever was sent
    if current_user.role.name == "customer_portal":
        portal_customer = await _get_portal_customer(current_user, db)
        if not portal_customer:
            raise HTTPException(status_code=403, detail="No customer account linked to this portal user")
        payload.customer_id = portal_customer.id

    from datetime import date
    date_str = date.today().strftime("%Y%m%d")
    count = await db.scalar(select(func.count(Job.id))) or 0
    job_no = f"JOB-{date_str}-{count + 1:04d}"

    job = Job(
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        job_no=job_no,
        tracking_token=secrets.token_urlsafe(32),
        **payload.model_dump(),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return _job_dict(job)


@router.get("/{job_id}", response_model=dict)
async def get_job(job_id: int, db: DB, current_user: CurrentUser):
    job = await _get_or_404(job_id, db)
    _assert_company(current_user, job)

    # Portal users can only view their own customer's jobs
    if current_user.role.name == "customer_portal":
        portal_customer = await _get_portal_customer(current_user, db)
        if not portal_customer or job.customer_id != portal_customer.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return _job_dict(job)


@router.patch("/{job_id}", response_model=dict)
async def update_job(
    job_id: int,
    payload: JobUpdate,
    db: DB,
    current_user: CurrentUser,
):
    job = await _get_or_404(job_id, db)
    _assert_company(current_user, job)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)

    await db.commit()
    await db.refresh(job)
    return _job_dict(job)


@router.get("/{job_id}/documents", response_model=list)
async def get_job_documents(job_id: int, db: DB, current_user: CurrentUser):
    from app.models.job import JobDocument
    job = await _get_or_404(job_id, db)
    _assert_company(current_user, job)

    result = await db.execute(
        select(JobDocument).where(JobDocument.job_id == job_id)
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "job_id": d.job_id,
            "doc_type": d.doc_type,
            "file_name": d.file_name,
            "file_url": d.file_url,
            "file_size_bytes": d.file_size_bytes,
            "mime_type": d.mime_type,
            "notes": d.notes,
            "uploaded_by_id": d.uploaded_by_id,
        }
        for d in docs
    ]


@router.post("/{job_id}/documents", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_job_document(
    job_id: int,
    db: DB,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    doc_type: str = "BOL",
    notes: Optional[str] = None,
):
    from app.models.job import JobDocument

    job = await _get_or_404(job_id, db)
    _assert_company(current_user, job)

    upload_dir = f"media/jobs/{job_id}"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    doc = JobDocument(
        job_id=job_id,
        uploaded_by_id=current_user.id,
        doc_type=doc_type,
        file_name=file.filename,
        file_url=f"/{file_path}",
        file_size_bytes=file.size,
        mime_type=file.content_type,
        notes=notes,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {
        "id": doc.id,
        "job_id": doc.job_id,
        "doc_type": doc.doc_type,
        "file_name": doc.file_name,
        "file_url": doc.file_url,
        "file_size_bytes": doc.file_size_bytes,
        "mime_type": doc.mime_type,
        "notes": doc.notes,
        "uploaded_by_id": doc.uploaded_by_id,
    }


@router.patch("/{job_id}/status", response_model=dict)
async def update_job_status(
    job_id: int,
    new_status: str,
    db: DB,
    current_user: CurrentUser,
):
    job = await _get_or_404(job_id, db)
    _assert_company(current_user, job)
    try:
        job.status = JobStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")
    await db.commit()
    await db.refresh(job)
    return _job_dict(job)


# ── Dispatch ──────────────────────────────────────────────────────────────────

@router.post("/{job_id}/dispatch", response_model=dict, status_code=status.HTTP_201_CREATED)
async def dispatch_job(
    job_id: int,
    payload: DispatchCreate,
    db: DB,
    current_user: CurrentUser,
):
    job = await _get_or_404(job_id, db)
    _assert_company(current_user, job)

    dispatch = Dispatch(
        job_id=job_id,
        driver_id=payload.driver_id,
        vehicle_id=payload.vehicle_id,
        assigned_by_id=current_user.id,
        status=DispatchStatus.ASSIGNED,
    )
    job.status = JobStatus.ASSIGNED
    db.add(dispatch)
    await db.commit()
    await db.refresh(dispatch)
    return {"id": dispatch.id, "job_id": job_id, "status": dispatch.status}


@router.patch("/{job_id}/dispatch/{dispatch_id}/status", response_model=dict)
async def update_dispatch_status(
    job_id: int,
    dispatch_id: int,
    new_status: str,
    db: DB,
    current_user: CurrentUser,
):
    result = await db.execute(
        select(Dispatch).where(Dispatch.id == dispatch_id, Dispatch.job_id == job_id)
    )
    dispatch = result.scalar_one_or_none()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    try:
        ds = DispatchStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")

    now = datetime.now(timezone.utc)
    dispatch.status = ds

    ts_map = {
        DispatchStatus.ACCEPTED:    "accepted_at",
        DispatchStatus.EN_ROUTE:    "en_route_at",
        DispatchStatus.AT_PICKUP:   "at_pickup_at",
        DispatchStatus.LOADED:      "loaded_at",
        DispatchStatus.AT_DELIVERY: "at_delivery_at",
        DispatchStatus.DELIVERED:   "delivered_at",
    }
    if ds in ts_map:
        setattr(dispatch, ts_map[ds], now)

    job = await _get_or_404(job_id, db)
    if ds in (DispatchStatus.EN_ROUTE, DispatchStatus.AT_PICKUP, DispatchStatus.LOADED, DispatchStatus.AT_DELIVERY):
        job.status = JobStatus.IN_PROGRESS
    elif ds == DispatchStatus.DELIVERED:
        job.status = JobStatus.COMPLETED
        job.actual_delivery_at = now

    await db.commit()
    return {"id": dispatch.id, "status": dispatch.status}


@router.patch("/{job_id}/dispatch/{dispatch_id}/pod", response_model=dict)
async def submit_pod(
    job_id: int,
    dispatch_id: int,
    payload: PODUpdate,
    db: DB,
    current_user: CurrentUser,
):
    result = await db.execute(
        select(Dispatch).where(Dispatch.id == dispatch_id, Dispatch.job_id == job_id)
    )
    dispatch = result.scalar_one_or_none()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(dispatch, field, value)

    dispatch.status = DispatchStatus.DELIVERED
    dispatch.delivered_at = datetime.now(timezone.utc)

    job = await _get_or_404(job_id, db)
    job.status = JobStatus.COMPLETED
    job.actual_delivery_at = dispatch.delivered_at

    await db.commit()
    return {"message": "POD submitted successfully"}


# ── Driver Location ───────────────────────────────────────────────────────────

@router.post("/location/ping", status_code=status.HTTP_204_NO_CONTENT)
async def driver_location_ping(
    payload: LocationPing,
    db: DB,
    current_user: CurrentUser,
):
    from app.models.entities import Driver, DriverLocationPing
    from sqlalchemy import update

    result = await db.execute(select(Driver).where(Driver.user_id == current_user.id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    await db.execute(
        update(Driver).where(Driver.id == driver.id).values(
            current_lat=payload.lat,
            current_lng=payload.lng,
            last_ping_at=datetime.now(timezone.utc),
        )
    )

    db.add(DriverLocationPing(
        driver_id=driver.id,
        job_id=payload.job_id,
        lat=payload.lat,
        lng=payload.lng,
        accuracy_m=payload.accuracy_m,
        speed_kmh=payload.speed_kmh,
        heading=payload.heading,
        pinged_at=datetime.now(timezone.utc),
    ))
    await db.commit()


# ── Public tracking ───────────────────────────────────────────────────────────

@router.get("/track/{token}", response_model=dict)
async def track_job(token: str, db: DB):
    result = await db.execute(select(Job).where(Job.tracking_token == token))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Invalid tracking link")

    from app.models.entities import Driver
    driver_location = None
    active_dispatch = None
    for d in (await db.execute(
        select(Dispatch).where(Dispatch.job_id == job.id, Dispatch.status.notin_(
            [DispatchStatus.DELIVERED, DispatchStatus.FAILED, DispatchStatus.REJECTED]
        ))
    )).scalars().all():
        active_dispatch = d
        drv = await db.get(Driver, d.driver_id)
        if drv:
            driver_location = {"lat": float(drv.current_lat or 0), "lng": float(drv.current_lng or 0)}
        break

    return {
        "job_no": job.job_no,
        "status": job.status,
        "pickup_address": job.pickup_address,
        "delivery_address": job.delivery_address,
        "scheduled_delivery_at": job.scheduled_delivery_at,
        "actual_delivery_at": job.actual_delivery_at,
        "driver_location": driver_location,
        "dispatch_status": active_dispatch.status if active_dispatch else None,
    }

