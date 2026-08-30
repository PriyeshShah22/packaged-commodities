from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401 - registers SQLAlchemy metadata
from app.api import router
from app.core.config import get_settings
from app.core.database import create_database_tables
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Role, User
from sqlalchemy import select


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_database_tables()
    seed_local_accounts()
    yield


def seed_local_accounts():
    with SessionLocal() as database:
        roles = {}
        for name in ("viewer", "inspector", "admin"):
            role = database.scalar(select(Role).where(Role.name == name))
            if not role:
                role = Role(name=name)
                database.add(role)
                database.flush()
            roles[name] = role
        demos = (
            ("officer.sharma@consumeraffairs.gov.in", "Insp. Ramesh Sharma", "Department of Consumer Affairs", "inspector"),
            ("admin@packmetrix.local", "PackMetrix Administrator", "PackMetrix", "admin"),
            ("viewer@packmetrix.local", "Report Viewer", "Compliance Directorate", "viewer"),
        )
        for email, name, organization, role_name in demos:
            if not database.scalar(select(User).where(User.email == email)):
                database.add(User(email=email, full_name=name, organization=organization, password_hash=hash_password("LegalMetrology2026!"), roles=[roles[role_name]]))
        database.commit()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix=settings.api_prefix)


@app.get("/health")
def health():
    return {"status": "ok", "service": "packmetrix-api", "rule_engine": "deterministic"}
