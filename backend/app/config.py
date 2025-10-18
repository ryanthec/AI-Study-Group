# backend/app/config.py
from __future__ import annotations

import os
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # -------------------------
    # App metadata
    # -------------------------
    APP_NAME: str = Field(default="AI Study Group API", description="Application name")
    APP_VERSION: str = Field(default="1.0.0", description="Application version")
    ENVIRONMENT: str = Field(default=os.getenv("ENVIRONMENT", "development"))
    DEBUG: bool = Field(default=os.getenv("DEBUG", "false").lower() == "true")

    # -------------------------
    # HTTP Server
    # -------------------------
    HOST: str = Field(default=os.getenv("HOST", "0.0.0.0"))
    PORT: int = Field(default=int(os.getenv("PORT", "8000")))

    # -------------------------
    # Database
    # -------------------------
    DATABASE_URL: str = Field(
        default=os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:password123@localhost:5432/ai_study_group",
        ),
        description="SQLAlchemy-compatible database URL",
    )

    RESET_DB_ON_STARTUP: bool = Field(default=False, description="DEV ONLY: drop and recreate tables on startup")

    # -------------------------
    # Redis / Caching
    # -------------------------
    REDIS_URL: str = Field(
        default=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        description="Redis connection URL",
    )

    # -------------------------
    # Security / Auth
    # -------------------------
    JWT_SECRET_KEY: str = Field(
        default=os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production"),
        description="JWT secret key (override in production)",
    )
    JWT_ALGORITHM: str = Field(default=os.getenv("JWT_ALGORITHM", "HS256"))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    )

    # -------------------------
    # CORS
    # -------------------------
    # Accept either a JSON array (e.g. '["http://localhost:3000","http://frontend:80"]')
    # or a comma/semicolon-separated string (e.g. 'http://localhost:3000,http://frontend:80').
    CORS_ORIGINS: List[str] = Field(default_factory=lambda: [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://frontend:80",
    ])

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        # If already a list (e.g., parsed from JSON), keep it
        if isinstance(v, list):
            return v

        # Fall back to env var or defaults if v is None/empty
        raw = os.getenv("CORS_ORIGINS", "")
        if not raw and isinstance(v, str):
            raw = v.strip()

        # If still empty, return default from Field(default_factory=...)
        if not raw:
            return ["http://localhost:3000", "http://frontend:80"]

        # Try JSON first
        raw_str = raw.strip()
        if raw_str.startswith("[") and raw_str.endswith("]"):
            try:
                import json

                parsed = json.loads(raw_str)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except Exception:
                pass  # fall back to CSV parsing

        # CSV / semicolon support
        parts = [p.strip() for p in raw_str.replace(";", ",").split(",") if p.strip()]
        return parts or ["http://localhost:3000", "http://frontend:80"]

    # -------------------------
    # File uploads
    # -------------------------
    UPLOAD_DIR: str = Field(default=os.getenv("UPLOAD_DIR", "/app/uploads"))
    MAX_FILE_SIZE: int = Field(default=int(os.getenv("MAX_FILE_SIZE", str(25 * 1024 * 1024))))  # 25 MB

    # -------------------------
    # AI / Gemini
    # -------------------------
    GEMINI_API_KEY: Optional[str] = Field(default=os.getenv("GEMINI_API_KEY"))

    # -------------------------
    # Misc
    # -------------------------
    LOG_LEVEL: str = Field(default=os.getenv("LOG_LEVEL", "INFO"))

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


# Singleton settings instance
settings = Settings()
