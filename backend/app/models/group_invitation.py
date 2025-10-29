from sqlalchemy import UUID, Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import secrets
from ..core.database import Base

class GroupInvitation(Base):
    __tablename__ = "group_invitations"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id"), nullable=False)
    inviter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    invitee_email = Column(String, nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_accepted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    group = relationship("StudyGroup", back_populates="invitations")
    inviter = relationship("User", foreign_keys=[inviter_id])
    
    @staticmethod
    def generate_token():
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def create_invitation(group_id: int, inviter_id: int, invitee_email: str):
        token = GroupInvitation.generate_token()
        expires_at = datetime.utcnow() + timedelta(days=7)  # 7-day expiration
        return GroupInvitation(
            group_id=group_id,
            inviter_id=inviter_id,
            invitee_email=invitee_email,
            token=token,
            expires_at=expires_at
        )
