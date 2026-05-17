"""Jobs router — request → job → dispatch → POD."""
import secrets
from typing import Annotated, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, DispatcherRequired, DriverRequired
from app.models.auth import User
from app.models.job import Dispatch, DispatchStatus, Job, JobStatus, ServiceRequest

router = APIRouter(prefix="/jobs", tags=["Jobs"])
DB = Annotated[AsyncSession, Depends(get_db)]


# ── Schemas (inline for brevity — move to schemas/job.py in full build) ────────

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
):
    q = select(Job).where(Job.company_id == current_user.company_id)

    if current_user.role.name == "driver":
        # Drivers see only their dispatched jobs
        q = (
            select(Job)
            .join(Dispatch, Dispatch.job_id == Job.id)
            .join(Job.company_id == current_user.company_id)
        )

    if status_filter:
        q = q.where(Job.status == status_filter)
    if customer_id:
        q = q.where(Job.customer_id == customer_id)
    if search:
        q = q.where(Job.job_no.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Job.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    jobs = result.scalars().all()

    return {"total": total, "page": page, "page_size": page_size, "results": [_job_dict(j) for j in jobs]}


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreate,
    db: DB,
    current_user: CurrentUser,
):
    # Auto-generate job number: JOB-YYYYMMDD-XXXX
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
    return _job_dict(job)


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
    """Drivers update their own dispatch status (en_route → at_pickup → loaded → delivered)."""
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

    # Auto-stamp timestamps
    ts_map = {
        DispatchStatus.ACCEPTED: "accepted_at",
        DispatchStatus.EN_ROUTE: "en_route_at",
        DispatchStatus.AT_PICKUP: "at_pickup_at",
        DispatchStatus.LOADED: "loaded_at",
        DispatchStatus.AT_DELIVERY: "at_delivery_at",
        DispatchStatus.DELIVERED: "delivered_at",
    }
    if ds in ts_map:
        setattr(dispatch, ts_map[ds], now)

    # Sync job status
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
    """Submit proof of delivery."""
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
    """Called by driver app every N seconds to update live location."""
    from app.models.entities import Driver, DriverLocationPing
    from sqlalchemy import update

    result = await db.execute(select(Driver).where(Driver.user_id == current_user.id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    # Update driver's current position
    await db.execute(
        update(Driver).where(Driver.id == driver.id).values(
            current_lat=payload.lat,
            current_lng=payload.lng,
            last_ping_at=datetime.now(timezone.utc),
        )
    )

    # Store ping in history
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
    """Public endpoint — no auth required. Customer uses shareable link."""
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
    }
