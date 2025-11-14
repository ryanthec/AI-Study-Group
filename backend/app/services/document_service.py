from sqlalchemy.orm import Session
from typing import List, Optional
import os
from pathlib import Path
from datetime import datetime

from ..models.document_embedding import Document, DocumentChunk
from .embedding_service import embedding_service

class DocumentService:
    
    @staticmethod
    def chunk_text(text: str, chunk_size: int = 2000, overlap: int = 400) -> List[str]:
        """
        Split text into overlapping chunks
        
        Args:
            text: Text to split
            chunk_size: Maximum characters per chunk
            overlap: Number of overlapping characters between chunks
        """
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            
            # Try to break at sentence boundary if possible
            if end < len(text):
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)
                
                if break_point > chunk_size * 0.5:  # Only break if we're past halfway
                    end = start + break_point + 1
                    chunk = text[start:end]
            
            chunks.append(chunk.strip())
            start = end - overlap
        
        return chunks
    
    @staticmethod
    def process_document(
        db: Session,
        group_id: int,
        uploader_id: int,
        filename: str,
        file_type: str,
        text_content: str,
        file_size: int = 0,
        chunk_size: int = 2000,
        overlap: int = 400
    ) -> Document:
        """
        Process uploaded document: extract text, chunk, embed, and discard file
        
        This is a single operation - no file storage needed!
        """
        # Create document record (metadata only)
        document = Document(
            group_id=group_id,
            uploader_id=uploader_id,
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            created_at=datetime.utcnow()
        )
        db.add(document)
        db.flush()  # Get document.id without committing
        
        # Split into chunks
        chunks = DocumentService.chunk_text(text_content, chunk_size, overlap)
        
        # Generate embeddings in batch
        embeddings = embedding_service.embed_batch(chunks)
        
        # Create chunk records with embeddings
        for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunk = DocumentChunk(
                document_id=document.id,
                chunk_index=idx,
                content=chunk_text,
                embedding=embedding,
                created_at=datetime.utcnow()
            )
            db.add(chunk)
        
        db.commit()
        db.refresh(document)
        return document
    
    @staticmethod
    def similarity_search(
        db: Session,
        query_text: str,
        group_id: Optional[int] = None,
        limit: int = 5,
        similarity_threshold: float = 0.7
    ) -> List[DocumentChunk]:
        """
        Find most relevant document chunks for a query
        
        Args:
            db: Database session
            query_text: User's query
            group_id: Optional group ID to filter results
            limit: Maximum number of results
            similarity_threshold: Minimum similarity score (0-1)
        """
        # Generate embedding for query
        query_embedding = embedding_service.embed_text(query_text)
        
        # Apply threshold filter at database level
        results = db.query(DocumentChunk).join(Document).filter(
            Document.group_id == group_id,
            DocumentChunk.embedding.cosine_distance(query_embedding) <= (1 - similarity_threshold)
        ).order_by(
            DocumentChunk.embedding.cosine_distance(query_embedding)
        ).limit(limit).all()
        
        return results
    
    @staticmethod
    def delete_document(db: Session, document_id: int, group_id: int) -> bool:
        """Delete document and all its chunks"""
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.group_id == group_id
        ).first()
        
        if document:
            # Cascade will delete chunks automatically
            db.delete(document)
            db.commit()
            return True
        
        return False


    @staticmethod
    def get_group_documents(db: Session, group_id: int) -> List[Document]:
        """Get all documents for a study group"""
        return db.query(Document).filter(
            Document.group_id == group_id
        ).order_by(Document.created_at.desc()).all()

    @staticmethod
    def get_document_by_id(db: Session, document_id: int, group_id: int) -> Optional[Document]:
        """Get a specific document"""
        return db.query(Document).filter(
            Document.id == document_id,
            Document.group_id == group_id
        ).first()