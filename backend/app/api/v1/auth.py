from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import create_access_token, verify_password, get_password_hash
from ...schemas.auth import LoginRequest, RegisterRequest, AuthResponse, TokenResponse
from ...models.user import User

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=AuthResponse)
async def register(
    user_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    """Register a new user"""
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        first_name=user_data.firstName,
        last_name=user_data.lastName
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create tokens
    access_token = create_access_token(data={"sub": db_user.email})
    refresh_token = create_access_token(
        data={"sub": db_user.email}, 
        expires_delta=timedelta(days=7)
    )
    
    return AuthResponse(
        user=db_user.to_dict(),
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/login", response_model=AuthResponse)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login user"""
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated"
        )
    
    # Create tokens
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_access_token(
        data={"sub": user.email}, 
        expires_delta=timedelta(days=7)
    )
    
    return AuthResponse(
        user=user.to_dict(),
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """Refresh access token"""
    # Implementation for token refresh
    pass
