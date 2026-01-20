from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from ..core.database import Base
from sqlalchemy.dialects.postgresql import UUID

class QuizScope(enum.Enum):
    GROUP = "group"
    PERSONAL = "personal"

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    study_group_id = Column(Integer, ForeignKey("study_groups.id"), nullable=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    questions = Column(JSON, nullable=False)
    # Store document IDs to access it later for gap analysis
    document_ids = Column(JSON, nullable=True)

    scope = Column(Enum(QuizScope), default=QuizScope.GROUP)
    num_questions = Column(Integer, default=10)
    
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    
    group = relationship("StudyGroup", back_populates="quizzes")
    creator = relationship("User", back_populates="created_quizzes")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    score = Column(Integer, nullable=False)
    total_questions = Column(Integer, nullable=False)
    answers = Column(JSON, nullable=False) 
    
    analysis_report = Column(Text, nullable=True)
    
    completed_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    
    quiz = relationship("Quiz", back_populates="attempts")
    user = relationship("User", back_populates="quiz_attempts")