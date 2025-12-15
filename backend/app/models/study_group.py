from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from ..core.database import Base
from sqlalchemy.dialects.postgresql import UUID
import uuid

class StudyGroupStatus(enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class StudyGroup(Base):
    __tablename__ = "study_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    module = Column(String(100))
    
    # Group settings
    max_members = Column(Integer, default=5)
    
    # Status and lifecycle
    status = Column(Enum(StudyGroupStatus), default=StudyGroupStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    
    # Creator/admin
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])
    memberships = relationship("StudyGroupMembership", back_populates="group", cascade="all, delete-orphan")
    messages = relationship("StudyGroupMessage", back_populates="group", cascade="all, delete-orphan")
    invitations = relationship("GroupInvitation", back_populates="group", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="group", cascade="all, delete-orphan")
    agent_config = relationship("GroupAgentConfig", uselist=False, back_populates="group", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "module": self.module,
            "max_members": self.max_members,
            "status": self.status.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "creator_id": self.creator_id,
            "member_count": len(self.memberships) if self.memberships else 0
        }
