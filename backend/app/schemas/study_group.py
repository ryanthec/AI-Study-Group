from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from uuid import UUID

class StudyGroupStatusEnum(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class CreateStudyGroupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    module: Optional[str] = Field(None, max_length=100)
    max_members: int = Field(default=5, ge=2, le=10)


class UpdateStudyGroupRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    module: Optional[str] = Field(None, max_length=100)
    max_members: Optional[int] = Field(None, ge=2, le=10)

class StudyGroupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    module: Optional[str]
    max_members: int
    status: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    creator_id: UUID
    member_count: int
    is_member: Optional[bool] = None  # Set by service layer
    is_admin: Optional[bool] = None  # Set by service layer

class StudyGroupListResponse(BaseModel):
    groups: List[StudyGroupResponse]
    total: int
    page: int
    size: int
