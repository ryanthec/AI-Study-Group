from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from pgvector.sqlalchemy import Vector
from ..core.database import Base

class ConversationChunk(Base):
    """
    Stores conversation chunks with embeddings
    Similar to DocumentChunk but for chat messages
    """
    __tablename__ = "conversation_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id"), nullable=False)
    
    # The chunk content
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)  # order within batch
    
    # Time window info
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    message_count = Column(Integer, default=0)
    
    # Vector embedding
    embedding = Column(Vector(768), nullable=False)
    
    # Batch tracking (to group chunks from same embedding session)
    batch_id = Column(String, nullable=False, index=True)  # e.g., "2025-11-01-00:00"
    
    # Creation tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    group = relationship("StudyGroup")
    
    __table_args__ = (
        Index(
            'conv_chunk_embedding_idx',
            embedding,
            postgresql_using='hnsw',
            postgresql_with={'m': 16, 'ef_construction': 64},
            postgresql_ops={'embedding': 'vector_cosine_ops'}
        ),
        Index('conv_chunk_group_active_idx', 'group_id', 'is_active'),
        Index('conv_chunk_batch_idx', 'batch_id'),
    )