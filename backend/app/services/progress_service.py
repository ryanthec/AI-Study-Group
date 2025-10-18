from sqlalchemy.orm import Session
from ..models.user_progress import UserProgress

class ProgressService:
    @staticmethod
    def get_or_create(db: Session, user_id):
        row = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
        if not row:
            row = UserProgress(user_id=user_id, sessions_completed=0)
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    @staticmethod
    def increment_sessions(db: Session, user_id: str, delta: int = 1) -> UserProgress:
        row = ProgressService.get_or_create(db, user_id)
        row.sessions_completed = (row.sessions_completed or 0) + delta
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def get_sessions_completed(db: Session, user_id: str) -> int:
        row = ProgressService.get_or_create(db, user_id)
        return row.sessions_completed or 0
