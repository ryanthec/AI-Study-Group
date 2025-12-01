from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class UserUpdate(BaseModel):
    # Username is now editable
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    # Preferences to store things like custom avatar color
    preferences: Optional[Dict[str, Any]] = None


class UserProfileResponse(BaseModel):
    id: str
    username: str
    email: str
    firstName: str
    lastName: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    
    class Config:
        from_attributes = True