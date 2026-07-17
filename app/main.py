from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.database import init_db

from app.routers import auth, users, jobs, customers, vendors, quotations
from app.routers import employees, drivers, fleet, documents, companies
from app.routers.accounting import coa, banks, invoices, reports,ledger
from app.routers.accounting.receipts import receipts_router, payments_router, journals_router
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.APP_ENV == "development":
        await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="UAE Logistics Platform API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)



app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/media", StaticFiles(directory="media"), name="media")


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "message": "Validation error"},
    )

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "A record with this data already exists."},
    )

P = settings.API_V1_PREFIX
app.include_router(auth.router,        prefix=P)
app.include_router(users.router,       prefix=P)
app.include_router(companies.router,   prefix=P)
app.include_router(customers.router,   prefix=P)
app.include_router(vendors.router,     prefix=P)
app.include_router(employees.router,   prefix=P)
app.include_router(drivers.router,     prefix=P)
app.include_router(fleet.router,       prefix=P)
app.include_router(quotations.router,  prefix=P)
app.include_router(jobs.router,        prefix=P)
app.include_router(documents.router,   prefix=P)
app.include_router(coa.router,         prefix=P)
app.include_router(banks.router,       prefix=P)
app.include_router(invoices.router,    prefix=P)
app.include_router(receipts_router,    prefix=P)
app.include_router(payments_router,    prefix=P)
app.include_router(journals_router,    prefix=P)
app.include_router(reports.router,     prefix=P)
app.include_router(ledger.router, prefix=P)


app.mount("/media", StaticFiles(directory="media"), name="media")

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "app": settings.APP_NAME, "version": "1.0.0"}

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}