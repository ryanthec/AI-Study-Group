from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from ..core.database import Base

class StudyGroupStatus(enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class StudyGroupType(enum.Enum):
    TIMED_SESSION = "timed_session"  # Has end time, auto-deletes
    ONGOING = "ongoing"              # Persistent until manually deleted

class StudyGroup(Base):
    __tablename__ = "study_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    subject = Column(String(50))  # Math, Science, etc.
    
    # Group settings
    max_members = Column(Integer, default=5)
    group_type = Column(Enum(StudyGroupType), default=StudyGroupType.ONGOING)
    session_duration_minutes = Column(Integer)  # For timed sessions
    
    # Status and lifecycle
    status = Column(Enum(StudyGroupStatus), default=StudyGroupStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True))  # Auto-delete time
    
    # Creator/admin
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])
    memberships = relationship("StudyGroupMembership", back_populates="group", cascade="all, delete-orphan")
    messages = relationship("StudyGroupMessage", back_populates="group", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "subject": self.subject,
            "max_members": self.max_members,
            "group_type": self.group_type.value,
            "session_duration_minutes": self.session_duration_minutes,
            "status": self.status.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "creator_id": self.creator_id,
            "member_count": len(self.memberships) if self.memberships else 0
        }
