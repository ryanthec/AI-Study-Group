from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base
from ..agents.teaching_agent import RAGMode

class GroupAgentConfig(Base):
    __tablename__ = "group_agent_configs"

    group_id = Column(Integer, ForeignKey("study_groups.id"), primary_key=True)
    
    # Core Settings
    rag_mode = Column(String, default=RAGMode.DOCUMENTS_ONLY.value)
    use_socratic_prompting = Column(Boolean, default=True)
    temperature = Column(Float, default=0.7)
    max_output_tokens = Column(Integer, default=2048)
    
    # Socratic Limits
    limit_factual = Column(Integer, default=1)
    limit_conceptual = Column(Integer, default=2)
    limit_applied = Column(Integer, default=2)
    limit_complex = Column(Integer, default=3)

    # Relationships
    group = relationship("StudyGroup", back_populates="agent_config")