from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:password123@localhost:5432/ai_study_group"
)

# Create engine
engine = create_engine(DATABASE_URL)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _import_all_models():
    """
    Import all model modules so that they register their tables
    with Base.metadata before create_all/drop_all is invoked.
    """
    from ..models import user
    from ..models import study_group
    from ..models import study_group_membership
    from ..models import study_group_message
    from ..models import user_progress

# Create tables
def create_tables():
    """
    DEV ONLY: Drops all tables and recreates them on startup.
    Guarded by RESET_DB_ON_STARTUP env var.
    """
    try:
        _import_all_models()

        reset = os.getenv("RESET_DB_ON_STARTUP", "true").lower() == "true"
        if reset:
            print("⚠️  RESET_DB_ON_STARTUP is enabled — dropping all tables...")
            Base.metadata.drop_all(bind=engine)
            print("✅ All tables dropped")

        print("🛠️  Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")