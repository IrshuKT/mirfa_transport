from typing import Annotated, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, AdminRequired
from app.models.auth import User
from app.models.entities import Employee, EmployeeStatus
from app.utils.pagination import paginate

router = APIRouter(prefix="/employees", tags=["Employees"])
DB = Annotated[AsyncSession, Depends(get_db)]


class EmployeeCreate(BaseModel):
    full_name: str
    employee_no: str
    designation: Optional[str] = None
    department: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    nationality: Optional[str] = None
    join_date: Optional[date] = None
    basic_salary: Optional[float] = None
    currency: str = "AED"
    # UAE compliance
    emirates_id: Optional[str] = None
    emirates_id_expiry: Optional[date] = None
    visa_no: Optional[str] = None
    visa_expiry: Optional[date] = None
    passport_no: Optional[str] = None
    passport_expiry: Optional[date] = None
    labour_card_no: Optional[str] = None
    labour_card_expiry: Optional[date] = None
    notes: Optional[str] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    basic_salary: Optional[float] = None
    status: Optional[EmployeeStatus] = None
    end_date: Optional[date] = None
    emirates_id: Optional[str] = None
    emirates_id_expiry: Optional[date] = None
    visa_no: Optional[str] = None
    visa_expiry: Optional[date] = None
    passport_no: Optional[str] = None
    passport_expiry: Optional[date] = None
    labour_card_no: Optional[str] = None
    labour_card_expiry: Optional[date] = None
    notes: Optional[str] = None


@router.get("")
async def list_employees(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    department: Optional[str] = None,
    emp_status: Optional[EmployeeStatus] = Query(None, alias="status"),
):
    q = select(Employee).where(Employee.company_id == current_user.company_id)
    if emp_status:
        q = q.where(Employee.status == emp_status)
    if department:
        q = q.where(Employee.department == department)
    if search:
        q = q.where(or_(
            Employee.full_name.ilike(f"%{search}%"),
            Employee.employee_no.ilike(f"%{search}%"),
        ))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Employee.full_name).offset((page - 1) * page_size).limit(page_size))
    return paginate(total, page, page_size, [_fmt(e) for e in result.scalars().all()])


@router.get("/expiry-alerts")
async def expiry_alerts(
    db: DB, current_user: CurrentUser,
    days_ahead: int = Query(30, ge=1, le=365),
):
    """Return employees with docs expiring within N days."""
    from datetime import timedelta
    cutoff = date.today() + timedelta(days=days_ahead)
    q = select(Employee).where(
        Employee.company_id == current_user.company_id,
        Employee.status == EmployeeStatus.ACTIVE,
        (
            (Employee.emirates_id_expiry <= cutoff) |
            (Employee.visa_expiry <= cutoff) |
            (Employee.passport_expiry <= cutoff) |
            (Employee.labour_card_expiry <= cutoff)
        ),
    )
    result = await db.execute(q.order_by(Employee.full_name))
    return [_fmt_with_expiry(e, cutoff) for e in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate, db: DB, current_user: CurrentUser,
    _: Annotated[User, AdminRequired],
):
    existing = await db.scalar(
        select(Employee).where(
            Employee.employee_no == payload.employee_no,
            Employee.company_id == current_user.company_id,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Employee number already exists")
    emp = Employee(company_id=current_user.company_id, **payload.model_dump())
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return _fmt(emp)


@router.get("/{employee_id}")
async def get_employee(employee_id: int, db: DB, current_user: CurrentUser):
    return _fmt(await _get_or_404(employee_id, current_user.company_id, db))


@router.patch("/{employee_id}")
async def update_employee(
    employee_id: int, payload: EmployeeUpdate, db: DB, current_user: CurrentUser,
    _: Annotated[User, AdminRequired],
):
    emp = await _get_or_404(employee_id, current_user.company_id, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(emp, k, v)
    await db.commit()
    return _fmt(emp)


async def _get_or_404(emp_id: int, company_id: int, db: AsyncSession) -> Employee:
    result = await db.execute(
        select(Employee).where(Employee.id == emp_id, Employee.company_id == company_id)
    )
    e = result.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Employee not found")
    return e


def _fmt(e: Employee) -> dict:
    return {
        "id": e.id, "employee_no": e.employee_no, "full_name": e.full_name,
        "designation": e.designation, "department": e.department,
        "email": e.email, "phone": e.phone, "mobile": e.mobile,
        "nationality": e.nationality, "join_date": e.join_date, "end_date": e.end_date,
        "status": e.status, "basic_salary": float(e.basic_salary) if e.basic_salary else None,
        "currency": e.currency,
        "emirates_id": e.emirates_id, "emirates_id_expiry": e.emirates_id_expiry,
        "visa_no": e.visa_no, "visa_expiry": e.visa_expiry,
        "passport_no": e.passport_no, "passport_expiry": e.passport_expiry,
        "labour_card_no": e.labour_card_no, "labour_card_expiry": e.labour_card_expiry,
        "notes": e.notes, "created_at": e.created_at,
    }


def _fmt_with_expiry(e: Employee, cutoff: date) -> dict:
    today = date.today()
    alerts = []
    for label, exp in [
        ("Emirates ID", e.emirates_id_expiry),
        ("Visa", e.visa_expiry),
        ("Passport", e.passport_expiry),
        ("Labour Card", e.labour_card_expiry),
    ]:
        if exp and exp <= cutoff:
            days_left = (exp - today).days
            alerts.append({"document": label, "expiry_date": exp, "days_remaining": days_left})
    return {**_fmt(e), "expiry_alerts": alerts}
