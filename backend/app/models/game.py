from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from ..core.database import Base
from sqlalchemy.dialects.postgresql import UUID

class GameStatus(enum.Enum):
    LOBBY = "lobby"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"

class GameDifficulty(enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class GameSession(Base):
    __tablename__ = "game_sessions"

    id = Column(Integer, primary_key=True, index=True)
    study_group_id = Column(Integer, ForeignKey("study_groups.id"), nullable=False)
    host_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    status = Column(Enum(GameStatus), default=GameStatus.LOBBY)
    difficulty = Column(Enum(GameDifficulty), default=GameDifficulty.MEDIUM)
    topic = Column(String(200))
    
    # Store flashcards as JSON: 
    # [{ "id": 1, "front": "Term", "back": "Definition", "options": ["Def A", "Def B", "Def C", "Def D"] }]
    cards = Column(JSON, nullable=False)
    
    current_card_index = Column(Integer, default=-1)
    
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    
    participants = relationship("GameParticipant", back_populates="session", cascade="all, delete-orphan")
    host = relationship("User")

class GameParticipant(Base):
    __tablename__ = "game_participants"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("game_sessions.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    score = Column(Integer, default=0)
    streak = Column(Integer, default=0) # For bonus points
    
    session = relationship("GameSession", back_populates="participants")
    user = relationship("User")