# app/models/document_embedding.py
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, LargeBinary
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base

class Document(Base):
    """Stores only the metadata uploaded documents"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id"), nullable=False)
    uploader_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    file_data = Column(LargeBinary, nullable=True)

    # Relationships
    group = relationship("StudyGroup", back_populates="documents")
    uploader = relationship("User")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    """Stores document chunks with embeddings for RAG"""
    __tablename__ = "document_chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)  # order within document
    content = Column(Text, nullable=False)  # actual text chunk
    
    # Vector embedding (gemini-embedding-001 produces 768-dimensional vectors)
    embedding = Column(Vector(768), nullable=False)
    
    metadata_ = Column("metadata", Text)  # JSON string for extra info
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    
    # Create indexes for efficient similarity search
    __table_args__ = (
        Index(
            'document_chunks_embedding_idx',
            embedding,
            postgresql_using='hnsw',
            postgresql_with={'m': 16, 'ef_construction': 64},
            postgresql_ops={'embedding': 'vector_cosine_ops'}
        ),
    )

