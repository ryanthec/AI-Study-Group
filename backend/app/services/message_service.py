from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from typing import Optional
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
        message_type: MessageType = MessageType.TEXT
    ) -> StudyGroupMessage:
        message = StudyGroupMessage(
            group_id=group_id,
            user_id=user_id,
            content=content,
            message_type=message_type,
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
        return db.query(StudyGroupMessage).filter(
            StudyGroupMessage.group_id == group_id
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
            "created_at": message.created_at.isoformat() if message.created_at else None,
            "user": {
                "id": str(user.id) if user else None,
                "username": user.username if user else "System",
                "avatar": user.avatar if user else None,
            } if user or message.message_type == MessageType.SYSTEM else None
        }
