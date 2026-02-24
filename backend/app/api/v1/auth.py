from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from ...core.database import get_db
from ...core.security import create_access_token, get_current_user, verify_password, get_password_hash, SECRET_KEY, ALGORITHM
from ...schemas.auth import LoginRequest, RegisterRequest, AuthResponse, TokenResponse
from ...models.user import User
from ...services.email_service import email_service

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register")
async def register(
    user_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    """Register a new user"""
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | (User.username == user_data.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username already registered"
        )
    
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        first_name=user_data.firstName,
        last_name=user_data.lastName,
        is_verified=False # Ensure it's False
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create verification token (lasts 24 hours)
    verification_token = create_access_token(
        data={"sub": db_user.email, "type": "verification"},
        expires_delta=timedelta(hours=24)
    )
    
    # Send verification email
    email_service.send_verification_email(db_user.email, db_user.first_name, verification_token)
    
    # Return a success message instead of the AuthResponse
    return {"message": "Registration successful. Please check your email to verify your account."}

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
    
    # Check if email is verified
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Please verify your email address before logging in. Check your inbox."
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


@router.get("/verify-email")
async def verify_email(token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "verification":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")
            
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            
        if user.is_verified:
            return {"message": "Email already verified. You can log in."}
            
        user.is_verified = True
        db.commit()
        
        return {"message": "Email successfully verified."}
        
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
    

@router.get("/me")
async def read_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Optionally re-fetch for freshest data
    return current_user.to_dict()


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """Refresh access token"""
    # Implementation for token refresh
    pass
