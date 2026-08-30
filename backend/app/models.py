import enum
import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def new_id() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InspectionMode(str, enum.Enum):
    PHYSICAL_PACKAGE = "physical_package"
    ECOMMERCE = "ecommerce"
    COMBINED = "combined"


class InspectionStatus(str, enum.Enum):
    DRAFT = "draft"
    ANALYZING = "analyzing"
    REVIEW = "review"
    COMPLETED = "completed"


class RuleOutcome(str, enum.Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    REVIEW = "REVIEW"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    organization: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    roles: Mapped[list["Role"]] = relationship(secondary="user_roles", back_populates="users")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    users: Mapped[list[User]] = relationship(secondary="user_roles", back_populates="roles")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"), primary_key=True)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str | None] = mapped_column(String(255), index=True)
    brand: Mapped[str | None] = mapped_column(String(255), index=True)
    category: Mapped[str] = mapped_column(String(50), default="unknown", index=True)
    barcode: Mapped[str | None] = mapped_column(String(100), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    inspections: Mapped[list["Inspection"]] = relationship(back_populates="product")


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    inspection_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    inspector_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"), index=True)
    mode: Mapped[InspectionMode] = mapped_column(Enum(InspectionMode))
    status: Mapped[InspectionStatus] = mapped_column(Enum(InspectionStatus), default=InspectionStatus.DRAFT)
    package_context: Mapped[str] = mapped_column(String(50), default="unknown")
    origin: Mapped[str] = mapped_column(String(50), default="unknown")
    sales_context: Mapped[str] = mapped_column(String(50), default="unknown")
    inspection_date: Mapped[date] = mapped_column(Date, default=date.today)
    rule_set_as_of: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    product: Mapped[Product | None] = relationship(back_populates="inspections")
    images: Mapped[list["ProductImage"]] = relationship(back_populates="inspection")
    attributes: Mapped[list["ExtractedAttribute"]] = relationship(back_populates="inspection")
    rule_results: Mapped[list["InspectionRuleResult"]] = relationship(back_populates="inspection")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    inspection_id: Mapped[str] = mapped_column(ForeignKey("inspections.id"), index=True)
    storage_url: Mapped[str] = mapped_column(Text)
    file_name: Mapped[str] = mapped_column(String(255))
    image_type: Mapped[str | None] = mapped_column(String(50))
    checksum_sha256: Mapped[str] = mapped_column(String(64), index=True)
    quality_status: Mapped[str] = mapped_column(String(30), default="unknown")
    quality_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    inspection: Mapped[Inspection] = relationship(back_populates="images")
    ocr_results: Mapped[list["OCRResult"]] = relationship(back_populates="image")


class OCRResult(Base):
    __tablename__ = "ocr_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    image_id: Mapped[str] = mapped_column(ForeignKey("product_images.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    bbox: Mapped[list[float]] = mapped_column(JSON)
    engine: Mapped[str] = mapped_column(String(100))
    engine_version: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    image: Mapped[ProductImage] = relationship(back_populates="ocr_results")


class ExtractedAttribute(Base):
    __tablename__ = "extracted_attributes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    inspection_id: Mapped[str] = mapped_column(ForeignKey("inspections.id"), index=True)
    image_id: Mapped[str | None] = mapped_column(ForeignKey("product_images.id"), index=True)
    ocr_result_id: Mapped[str | None] = mapped_column(ForeignKey("ocr_results.id"))
    field: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[str] = mapped_column(Text)
    normalized_value: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    source_type: Mapped[str] = mapped_column(String(30), default="ocr")
    bbox: Mapped[list[float] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    inspection: Mapped[Inspection] = relationship(back_populates="attributes")


class LegalRuleSnapshot(Base):
    __tablename__ = "legal_rules"
    __table_args__ = (UniqueConstraint("rule_id", "version", name="uq_legal_rule_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    rule_id: Mapped[str] = mapped_column(String(100), index=True)
    version: Mapped[str] = mapped_column(String(50))
    effective_date: Mapped[date] = mapped_column(Date)
    source_document: Mapped[str] = mapped_column(String(150))
    source_url: Mapped[str] = mapped_column(Text)
    rule_reference: Mapped[str] = mapped_column(String(100))
    requirement: Mapped[str] = mapped_column(Text)
    registry_payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class InspectionRuleResult(Base):
    __tablename__ = "inspection_rule_results"
    __table_args__ = (UniqueConstraint("inspection_id", "rule_id", name="uq_inspection_rule"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    inspection_id: Mapped[str] = mapped_column(ForeignKey("inspections.id"), index=True)
    legal_rule_snapshot_id: Mapped[str | None] = mapped_column(ForeignKey("legal_rules.id"))
    rule_id: Mapped[str] = mapped_column(String(100), index=True)
    rule_version: Mapped[str] = mapped_column(String(50))
    source_reference: Mapped[str] = mapped_column(Text)
    ai_outcome: Mapped[RuleOutcome] = mapped_column(Enum(RuleOutcome))
    reason: Mapped[str] = mapped_column(Text)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    inspection: Mapped[Inspection] = relationship(back_populates="rule_results")
    evidence: Mapped[list["Evidence"]] = relationship(back_populates="rule_result")
    decisions: Mapped[list["InspectorDecision"]] = relationship(back_populates="rule_result")


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    rule_result_id: Mapped[str] = mapped_column(ForeignKey("inspection_rule_results.id"), index=True)
    image_id: Mapped[str | None] = mapped_column(ForeignKey("product_images.id"), index=True)
    extracted_attribute_id: Mapped[str | None] = mapped_column(ForeignKey("extracted_attributes.id"))
    evidence_type: Mapped[str] = mapped_column(String(50))
    field: Mapped[str] = mapped_column(String(100))
    value: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float)
    bbox: Mapped[list[float] | None] = mapped_column(JSON)

    rule_result: Mapped[InspectionRuleResult] = relationship(back_populates="evidence")


class InspectorDecision(Base):
    __tablename__ = "inspector_decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    rule_result_id: Mapped[str] = mapped_column(ForeignKey("inspection_rule_results.id"), index=True)
    inspector_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    decision: Mapped[str] = mapped_column(String(30))
    remark: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    rule_result: Mapped[InspectionRuleResult] = relationship(back_populates="decisions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    inspection_id: Mapped[str | None] = mapped_column(ForeignKey("inspections.id"), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    old_value: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    new_value: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    request_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
