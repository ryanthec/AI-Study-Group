from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from .core.database import get_db
from .core.security import get_current_user
from .models.user import User

# Database dependency (already in core/database.py but re-exported here)
def get_database() -> Session:
    return get_db()

# Current user dependency
def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

# Admin user dependency (for future use)
def get_current_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    # Add admin role check here when you implement roles
    return current_user
