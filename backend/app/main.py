from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import os

from .core.database import engine, create_tables
from .config import settings
from .api.v1 import auth, study_groups, dashboard, chat, invitations, documents, users, agent_config, quizzes, voice_chat, games
from .models import user

# Create tables on startup
create_tables()

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI Study Group Backend API",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://167.71.217.164", "https://167.71.217.164"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload dir if not exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Mount the uploads directory to serve static files
# This means http://localhost:8000/uploads/xyz.png -> serves file from settings.UPLOAD_DIR
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# Health check endpoint (for Docker healthcheck)
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "AI Study Group Backend is running"}

# Include API routes
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(study_groups.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(invitations.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(agent_config.router, prefix="/api/v1")
app.include_router(quizzes.router, prefix="/api/v1")
app.include_router(voice_chat.router, prefix="/api/v1")
app.include_router(games.router, prefix="/api/v1")



# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Welcome to AI Study Group API",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }

# Startup event
@app.on_event("startup")
async def startup_event():
    print(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} starting up...")
    print(f"📝 Documentation available at: /docs")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    print("👋 AI Study Group Backend shutting down...")
