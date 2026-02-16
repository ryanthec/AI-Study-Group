from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from ..models.study_group_message import StudyGroupMessage, MessageType
from ..models.user import User

class MessageService:
    @staticmethod
    def create_message(
        db: Session,
        group_id: int,
        user_id: Optional[UUID] = None,
        content: str = "",
        message_type: MessageType = MessageType.TEXT,
        is_private: bool = False,
        recipient_id: Optional[UUID] = None # To link AI replies to a specific user
    ) -> StudyGroupMessage:
        message = StudyGroupMessage(
            group_id=group_id,
            user_id=user_id,
            content=content,
            message_type=message_type,
            is_private=is_private,
            recipient_id=recipient_id, 
            created_at=datetime.utcnow()
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        return message
    
    @staticmethod
    def get_group_messages(
        db: Session,
        group_id: int,
        limit: int = 100,
        offset: int = 0
    ) -> List[StudyGroupMessage]:
        """Fetch only PUBLIC messages for the group chat."""
        return db.query(StudyGroupMessage).filter(
            StudyGroupMessage.group_id == group_id,
            StudyGroupMessage.is_private == False  # Filter out private chats
        ).order_by(
            StudyGroupMessage.created_at.asc()
        ).offset(offset).limit(limit).all()

    @staticmethod
    def get_private_messages(
        db: Session,
        group_id: int,
        user_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> List[StudyGroupMessage]:
        """
        Fetch PRIVATE conversation history for a specific user.
        Includes:
        1. Messages sent BY the user (user_id match)
        2. Messages sent TO the user (recipient_id match, e.g., from AI)
        """
        return db.query(StudyGroupMessage).filter(
            StudyGroupMessage.group_id == group_id,
            StudyGroupMessage.is_private == True,
            or_(
                StudyGroupMessage.user_id == user_id,
                StudyGroupMessage.recipient_id == user_id
            )
        ).order_by(
            StudyGroupMessage.created_at.asc()
        ).offset(offset).limit(limit).all()
    
    @staticmethod
    def format_message_for_ws(message: StudyGroupMessage, db: Session) -> dict:
        user = None
        if message.user_id:
            user = db.query(User).filter(User.id == message.user_id).first()
        
        return {
            "id": message.id,
            "group_id": message.group_id,
            "content": message.content,
            "message_type": message.message_type.value,
            "is_private": message.is_private,
            "created_at": message.created_at.isoformat() if message.created_at else None,
            "user": {
                "id": str(user.id) if user else None,
                "username": user.username if user else "TeachingAI", # Fallback for AI
                "avatar": user.avatar if user else None,
            } if user or message.message_type == MessageType.AI_RESPONSE else None
        }