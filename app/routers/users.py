from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, AdminRequired
from app.core.security import hash_password
from app.models.auth import User, UserStatus, Role
from app.schemas.auth import UserCreate, UserResponse, UserUpdate

from app.services.invitation_service import _generate_temp_password

router = APIRouter(prefix="/users", tags=["Users"])
DB = Annotated[AsyncSession, Depends(get_db)]



# ── Roles list — MUST be before /{user_id} routes ────────────────────────────
@router.get("/roles")
async def list_roles(db: DB, current_user: CurrentUser):
    """Return all roles so frontend can map name → id."""
    result = await db.execute(select(Role).order_by(Role.id))
    roles = result.scalars().all()
    return [{"id": r.id, "name": r.name, "description": r.description} for r in roles]


# ── List users ────────────────────────────────────────────────────────────────
@router.get("", response_model=dict)
async def list_users(
    db: DB,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    role_id: Optional[int] = None,
    status: Optional[str] = None,
):
    q = select(User).options(selectinload(User.role))

    if current_user.role.name != "super_admin":
        q = q.where(User.company_id == current_user.company_id)
        q = q.join(Role).where(Role.name != "super_admin")
    if search:
        q = q.where(
            User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )
    if role_id:
        q = q.where(User.role_id == role_id)
    if status:
        q = q.where(User.status == status)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(
        q.order_by(User.full_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    users = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "results": [_to_response(u) for u in users],
    }


# ── Create user ───────────────────────────────────────────────────────────────
@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[AdminRequired])
async def create_user(
    payload: UserCreate,
    db: DB,
    current_user: CurrentUser,
):
    company_id = payload.company_id or current_user.company_id
    if current_user.role.name != "super_admin" and company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Cannot create user for another company")

    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        role_id=payload.role_id,
        company_id=company_id,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user, ["role"])
    await db.commit()
    return _to_response(user)

# ── Re activate user ──────────────────────────────────────────────────────────────────

@router.patch("/{user_id}/reactivate", dependencies=[AdminRequired])
async def reactivate_user(user_id: int, db: DB, current_user: CurrentUser):
    user = await _get_or_404(user_id, db)
    _assert_access(current_user, user)
    user.status = UserStatus.ACTIVE
    await db.commit()
    return {"message": "User reactivated"}

# ── Delete user ──────────────────────────────────────────────────────────────────

@router.delete("/{user_id}/permanent", dependencies=[AdminRequired])
async def delete_user(user_id: int, db: DB, current_user: CurrentUser):
    user = await _get_or_404(user_id, db)
    _assert_access(current_user, user)
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.delete(user)
    await db.commit()

# ── Get user ──────────────────────────────────────────────────────────────────
@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: DB, current_user: CurrentUser):
    user = await _get_or_404(user_id, db)
    _assert_access(current_user, user)
    return _to_response(user)


# ── Update user ───────────────────────────────────────────────────────────────
@router.patch("/{user_id}", response_model=UserResponse,
              dependencies=[AdminRequired])
async def update_user(
    user_id: int, payload: UserUpdate, db: DB, current_user: CurrentUser,
):
    user = await _get_or_404(user_id, db)
    _assert_access(current_user, user)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user, ["role"])
    return _to_response(user)


# ── Deactivate user ───────────────────────────────────────────────────────────
@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[AdminRequired])
async def deactivate_user(
    user_id: int, db: DB, current_user: CurrentUser,
):
    user = await _get_or_404(user_id, db)
    _assert_access(current_user, user)
    user.status = UserStatus.INACTIVE
    await db.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _get_or_404(user_id: int, db: AsyncSession) -> User:
    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _assert_access(current_user: User, target: User) -> None:
    if current_user.role.name == "super_admin":
        return
    if current_user.company_id != target.company_id:
        raise HTTPException(status_code=403, detail="Access denied")


def _to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role.name,
        company_id=user.company_id,
        status=user.status,
        totp_enabled=user.totp_enabled,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


# ── Create user with welcome email ────────────────────────────────────────────
from app.services.invitation_service import create_staff_user as _create_with_invite
from pydantic import BaseModel as _BaseModel, EmailStr as _EmailStr

class InviteUserRequest(_BaseModel):
    full_name: str
    email: _EmailStr
    phone: str | None = None
    role_name: str
    send_welcome_email: bool = True

@router.post("/invite", status_code=status.HTTP_201_CREATED, dependencies=[AdminRequired])
async def invite_user(payload: InviteUserRequest, db: DB, current_user: CurrentUser):
    """
    Create a user by role NAME (not ID) and send welcome email.
    Returns temp_password so admin can share manually if needed.
    """
    try:
        result = await _create_with_invite(
            db=db,
            company_id=current_user.company_id,
            role_name=payload.role_name,
            full_name=payload.full_name,
            email=str(payload.email),
            phone=payload.phone,
            created_by_id=current_user.id,
            send_welcome=payload.send_welcome_email,
        )
        return {"message": f"User '{payload.full_name}' created successfully", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    

    #// user password rest ----------------

@router.post("/{user_id}/reset-password", dependencies=[AdminRequired])
async def reset_password(user_id: int, db: DB, current_user: CurrentUser):
    user = await _get_or_404(user_id, db)
    _assert_access(current_user, user)
    temp_password = _generate_temp_password()
    user.hashed_password = hash_password(temp_password)
    await db.commit()
    return {"temp_password": temp_password, "email": user.email}