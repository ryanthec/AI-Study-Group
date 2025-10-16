from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class StudyGroupTypeEnum(str, Enum):
    TIMED_SESSION = "timed_session"
    ONGOING = "ongoing"

class StudyGroupStatusEnum(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class CreateStudyGroupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    subject: Optional[str] = Field(None, max_length=50)
    max_members: int = Field(default=5, ge=2, le=10)
    group_type: StudyGroupTypeEnum = Field(default=StudyGroupTypeEnum.ONGOING)
    session_duration_minutes: Optional[int] = Field(None, ge=30, le=720)  # 30 min to 12 hours

class UpdateStudyGroupRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    subject: Optional[str] = Field(None, max_length=50)
    max_members: Optional[int] = Field(None, ge=2, le=10)

class StudyGroupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    subject: Optional[str]
    max_members: int
    group_type: str
    session_duration_minutes: Optional[int]
    status: str
    created_at: Optional[datetime]
    expires_at: Optional[datetime]
    creator_id: int
    member_count: int
    is_member: Optional[bool] = None  # Set by service layer

class StudyGroupListResponse(BaseModel):
    groups: List[StudyGroupResponse]
    total: int
    page: int
    size: int
