from typing import Annotated, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, AdminRequired
from app.models.auth import User
from app.models.entities import Vehicle, VehicleMaintenance, VehicleStatus
from app.utils.pagination import paginate

router = APIRouter(prefix="/fleet", tags=["Fleet"])
DB = Annotated[AsyncSession, Depends(get_db)]


class VehicleCreate(BaseModel):
    plate_no: str
    fleet_no: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    vehicle_type: Optional[str] = None
    payload_tons: Optional[float] = None
    mulkiya_expiry: Optional[date] = None
    insurance_expiry: Optional[date] = None
    insurance_policy_no: Optional[str] = None
    rta_permit_expiry: Optional[date] = None
    notes: Optional[str] = None


class VehicleUpdate(BaseModel):
    fleet_no: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    vehicle_type: Optional[str] = None
    payload_tons: Optional[float] = None
    status: Optional[VehicleStatus] = None
    mulkiya_expiry: Optional[date] = None
    insurance_expiry: Optional[date] = None
    insurance_policy_no: Optional[str] = None
    rta_permit_expiry: Optional[date] = None
    notes: Optional[str] = None


class MaintenanceCreate(BaseModel):
    maintenance_type: str
    description: Optional[str] = None
    service_date: date
    next_service_date: Optional[date] = None
    odometer_km: Optional[int] = None
    cost: Optional[float] = None
    currency: str = "AED"
    vendor_name: Optional[str] = None
    invoice_ref: Optional[str] = None


@router.get("")
async def list_vehicles(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    vehicle_status: Optional[VehicleStatus] = Query(None, alias="status"),
    search: Optional[str] = None,
):
    q = select(Vehicle).where(Vehicle.company_id == current_user.company_id)
    if vehicle_status:
        q = q.where(Vehicle.status == vehicle_status)
    if search:
        q = q.where(Vehicle.plate_no.ilike(f"%{search}%") | Vehicle.fleet_no.ilike(f"%{search}%"))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Vehicle.plate_no).offset((page - 1) * page_size).limit(page_size))
    return paginate(total, page, page_size, [_fmt(v) for v in result.scalars().all()])


@router.get("/expiry-alerts")
async def vehicle_expiry_alerts(
    db: DB, current_user: CurrentUser,
    days_ahead: int = Query(30, ge=1, le=365),
):
    """Vehicles with Mulkiya / insurance / RTA permit expiring soon."""
    from datetime import timedelta
    cutoff = date.today() + timedelta(days=days_ahead)
    q = select(Vehicle).where(
        Vehicle.company_id == current_user.company_id,
        Vehicle.status == VehicleStatus.ACTIVE,
        (
            (Vehicle.mulkiya_expiry <= cutoff) |
            (Vehicle.insurance_expiry <= cutoff) |
            (Vehicle.rta_permit_expiry <= cutoff)
        ),
    )
    result = await db.execute(q)
    return [_fmt_with_expiry(v, cutoff) for v in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    payload: VehicleCreate, db: DB, current_user: CurrentUser,
    _: Annotated[User, AdminRequired],
):
    existing = await db.scalar(
        select(Vehicle).where(Vehicle.plate_no == payload.plate_no)
    )
    if existing:
        raise HTTPException(status_code=400, detail="Plate number already registered")
    vehicle = Vehicle(company_id=current_user.company_id, **payload.model_dump())
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    return _fmt(vehicle)


@router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: int, db: DB, current_user: CurrentUser):
    return _fmt(await _get_or_404(vehicle_id, current_user.company_id, db))


@router.patch("/{vehicle_id}")
async def update_vehicle(
    vehicle_id: int, payload: VehicleUpdate, db: DB, current_user: CurrentUser,
    _: Annotated[User, AdminRequired],
):
    vehicle = await _get_or_404(vehicle_id, current_user.company_id, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(vehicle, k, v)
    await db.commit()
    return _fmt(vehicle)


# ── Maintenance records ───────────────────────────────────────────────────────

@router.get("/{vehicle_id}/maintenance")
async def list_maintenance(
    vehicle_id: int, db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
):
    await _get_or_404(vehicle_id, current_user.company_id, db)
    q = select(VehicleMaintenance).where(VehicleMaintenance.vehicle_id == vehicle_id)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(VehicleMaintenance.service_date.desc()).offset((page - 1) * page_size).limit(page_size))
    records = result.scalars().all()
    return paginate(total, page, page_size, [
        {"id": r.id, "maintenance_type": r.maintenance_type, "description": r.description,
         "service_date": r.service_date, "next_service_date": r.next_service_date,
         "odometer_km": r.odometer_km, "cost": float(r.cost) if r.cost else None,
         "currency": r.currency, "vendor_name": r.vendor_name, "invoice_ref": r.invoice_ref}
        for r in records
    ])


@router.post("/{vehicle_id}/maintenance", status_code=status.HTTP_201_CREATED)
async def add_maintenance(
    vehicle_id: int, payload: MaintenanceCreate, db: DB, current_user: CurrentUser,
):
    await _get_or_404(vehicle_id, current_user.company_id, db)
    record = VehicleMaintenance(
        vehicle_id=vehicle_id,
        recorded_by_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return {"id": record.id, "message": "Maintenance record added"}


async def _get_or_404(vehicle_id: int, company_id: int, db: AsyncSession) -> Vehicle:
    result = await db.execute(
        select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.company_id == company_id)
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return v


def _fmt(v: Vehicle) -> dict:
    return {
        "id": v.id, "plate_no": v.plate_no, "fleet_no": v.fleet_no,
        "make": v.make, "model": v.model, "year": v.year,
        "vehicle_type": v.vehicle_type,
        "payload_tons": float(v.payload_tons) if v.payload_tons else None,
        "status": v.status,
        "mulkiya_expiry": v.mulkiya_expiry,
        "insurance_expiry": v.insurance_expiry,
        "insurance_policy_no": v.insurance_policy_no,
        "rta_permit_expiry": v.rta_permit_expiry,
        "notes": v.notes, "created_at": v.created_at,
    }


def _fmt_with_expiry(v: Vehicle, cutoff: date) -> dict:
    today = date.today()
    alerts = []
    for label, exp in [
        ("Mulkiya", v.mulkiya_expiry),
        ("Insurance", v.insurance_expiry),
        ("RTA Permit", v.rta_permit_expiry),
    ]:
        if exp and exp <= cutoff:
            alerts.append({"document": label, "expiry_date": exp, "days_remaining": (exp - today).days})
    return {**_fmt(v), "expiry_alerts": alerts}
