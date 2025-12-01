import os
import uuid
import shutil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...schemas.user import UserUpdate, UserProfileResponse
from ...config import settings

router = APIRouter(prefix="/users", tags=["users"])

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

@router.patch("/me", response_model=UserProfileResponse)
async def update_user_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update username and preferences"""
    
    # 1. Handle Username Update with Uniqueness Check
    if update_data.username is not None and update_data.username != current_user.username:
        existing_user = db.query(User).filter(User.username == update_data.username).first()
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="This username is already taken."
            )
        current_user.username = update_data.username

    # 2. Handle Preferences Update (Merge with existing)
    if update_data.preferences is not None:
        # Ensure current_user.preferences is a dict
        current_prefs = dict(current_user.preferences) if current_user.preferences else {}
        current_prefs.update(update_data.preferences)
        current_user.preferences = current_prefs
        
    db.commit()
    db.refresh(current_user)
    return current_user.to_dict()



