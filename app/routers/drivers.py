from typing import Annotated, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel 
from pydantic import BaseModel as _BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, AdminRequired, DispatcherRequired
from app.models.auth import User
from app.models.entities import Driver, DriverAvailability
from app.utils.pagination import paginate

router = APIRouter(prefix="/drivers", tags=["Drivers"])
DB = Annotated[AsyncSession, Depends(get_db)]


class DriverCreate(BaseModel):
    driver_code: str
    full_name: str
    mobile: str
    user_id: int
    employee_id: Optional[int] = None
    license_no: Optional[str] = None
    license_expiry: Optional[date] = None
    license_type: Optional[str] = None
    notes: Optional[str] = None


class DriverUpdate(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    license_no: Optional[str] = None
    license_expiry: Optional[date] = None
    license_type: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class FCMTokenUpdate(BaseModel):
    fcm_token: str


@router.get("")
async def list_drivers(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    availability: Optional[DriverAvailability] = None,
    is_active: Optional[bool] = True,
    search: Optional[str] = None,
):
    q = select(Driver).where(Driver.company_id == current_user.company_id)
    if is_active is not None:
        q = q.where(Driver.is_active == is_active)
    if availability:
        q = q.where(Driver.availability == availability)
    if search:
        q = q.where(Driver.full_name.ilike(f"%{search}%") | Driver.driver_code.ilike(f"%{search}%"))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Driver.full_name).offset((page - 1) * page_size).limit(page_size))
    return paginate(total, page, page_size, [_fmt(d) for d in result.scalars().all()])


@router.get("/available")
async def available_drivers(db: DB, current_user: CurrentUser):
    """Quick list of available drivers for dispatch selection."""
    result = await db.execute(
        select(Driver).where(
            Driver.company_id == current_user.company_id,
            Driver.availability == DriverAvailability.AVAILABLE,
            Driver.is_active == True,
        ).order_by(Driver.full_name)
    )
    return [_fmt(d) for d in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_driver(
    payload: DriverCreate, db: DB, current_user: CurrentUser,
):
    existing = await db.scalar(
        select(Driver).where(Driver.driver_code == payload.driver_code, Driver.company_id == current_user.company_id)
    )
    if existing:
        raise HTTPException(status_code=400, detail="Driver code already exists")
    driver = Driver(company_id=current_user.company_id, **payload.model_dump())
    db.add(driver)
    await db.commit()
    await db.refresh(driver)
    return _fmt(driver)


@router.get("/{driver_id}")
async def get_driver(driver_id: int, db: DB, current_user: CurrentUser):
    return _fmt(await _get_or_404(driver_id, current_user.company_id, db))


@router.patch("/{driver_id}")
async def update_driver(
    driver_id: int, payload: DriverUpdate, db: DB, current_user: CurrentUser,
):
    driver = await _get_or_404(driver_id, current_user.company_id, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(driver, k, v)
    await db.commit()
    return _fmt(driver)


@router.patch("/{driver_id}/availability")
async def set_availability(
    driver_id: int, availability: DriverAvailability,
    db: DB, current_user: CurrentUser,
):
    """Driver or dispatcher can toggle availability."""
    driver = await _get_or_404(driver_id, current_user.company_id, db)
    driver.availability = availability
    await db.commit()
    return {"driver_id": driver_id, "availability": driver.availability}


@router.patch("/{driver_id}/fcm-token", status_code=status.HTTP_204_NO_CONTENT)
async def update_fcm_token(
    driver_id: int, payload: FCMTokenUpdate, db: DB, current_user: CurrentUser,
):
    """Called by driver mobile app to register/refresh push notification token."""
    driver = await _get_or_404(driver_id, current_user.company_id, db)
    driver.fcm_token = payload.fcm_token
    await db.commit()


@router.get("/{driver_id}/location")
async def get_driver_location(driver_id: int, db: DB, current_user: CurrentUser):
    driver = await _get_or_404(driver_id, current_user.company_id, db)
    return {
        "driver_id": driver.id,
        "full_name": driver.full_name,
        "lat": float(driver.current_lat) if driver.current_lat else None,
        "lng": float(driver.current_lng) if driver.current_lng else None,
        "last_ping_at": driver.last_ping_at,
        "availability": driver.availability,
    }


async def _get_or_404(driver_id: int, company_id: int, db: AsyncSession) -> Driver:
    result = await db.execute(
        select(Driver).where(Driver.id == driver_id, Driver.company_id == company_id)
    )
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found")
    return d


def _fmt(d: Driver) -> dict:
    return {
        "id": d.id, "driver_code": d.driver_code, "full_name": d.full_name,
        "mobile": d.mobile, "user_id": d.user_id, "employee_id": d.employee_id,
        "license_no": d.license_no, "license_expiry": d.license_expiry, "license_type": d.license_type,
        "availability": d.availability, "is_active": d.is_active,
        "current_lat": float(d.current_lat) if d.current_lat else None,
        "current_lng": float(d.current_lng) if d.current_lng else None,
        "last_ping_at": d.last_ping_at, "notes": d.notes, "created_at": d.created_at,
    }

@router.post("/me/fcm-token")
async def update_fcm_token(
    payload: FCMTokenUpdate,
    db: DB,
    current_user: CurrentUser,
):
    result = await db.execute(
        select(Driver).where(Driver.user_id == current_user.id)
    )
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(404, "Driver profile not found")
    driver.fcm_token = payload.fcm_token
    await db.commit()
    return {"message": "FCM token updated"}