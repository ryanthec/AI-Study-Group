from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any
from datetime import datetime

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    confirmPassword: str
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)

    def validate_passwords_match(self):
        if self.password != self.confirmPassword:
            raise ValueError("Passwords do not match")
        return self

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    firstName: str
    lastName: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    isActive: bool
    isVerified: bool
    preferences: Optional[Dict[str, Any]] = None
    createdAt: datetime
    updatedAt: Optional[datetime] = None

class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
