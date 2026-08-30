from datetime import date
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: str
    organization: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class InspectionMode(str, Enum):
    PHYSICAL_PACKAGE = "physical_package"
    ECOMMERCE = "ecommerce"
    COMBINED = "combined"


class InspectionContext(BaseModel):
    inspection_mode: InspectionMode
    package_context: str = "unknown"
    product_category: str = "unknown"
    origin: str = "unknown"
    sales_context: str = "unknown"
    product_conditions: set[str] = Field(default_factory=set)
    inspection_date: date = Field(default_factory=date.today)


class ApplicabilityState(str, Enum):
    APPLICABLE = "APPLICABLE"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    UNCERTAIN = "UNCERTAIN"


class EvidenceItem(BaseModel):
    field: str
    value: str
    confidence: float = Field(ge=0, le=1)
    source_type: str = "ocr"
    image_id: str | None = None
    bbox: list[float] | None = None

    @model_validator(mode="after")
    def validate_bbox(self):
        if self.bbox is not None and len(self.bbox) != 4:
            raise ValueError("bbox must contain [x1, y1, x2, y2]")
        return self


class CoverageState(str, Enum):
    COMPLETE = "complete"
    INCOMPLETE = "incomplete"
    UNKNOWN = "unknown"


class QualityState(str, Enum):
    SUFFICIENT = "sufficient"
    INSUFFICIENT = "insufficient"
    UNKNOWN = "unknown"


class ImageQuality(BaseModel):
    image_id: str
    status: QualityState


class ValidationRequest(BaseModel):
    context: InspectionContext
    evidence: list[EvidenceItem] = Field(default_factory=list)
    field_coverage: dict[str, CoverageState] = Field(default_factory=dict)
    image_quality: list[ImageQuality] = Field(default_factory=list)
    as_of: date | None = None
