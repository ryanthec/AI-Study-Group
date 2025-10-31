# app/services/conversation_embedding_service.py
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import hashlib

from ..models.conversation_embedding import ConversationChunk
from ..models.study_group_message import StudyGroupMessage, MessageType
from .embedding_service import embedding_service

class ConversationEmbeddingService:
    
    @staticmethod
    def chunk_conversation(
        messages: List[StudyGroupMessage],
        chunk_size: int = 1000,
        overlap: int = 100
    ) -> List[str]:
        """
        Split conversation into overlapping chunks
        Similar to document chunking
        """
        # Build full conversation text
        full_text = []
        for msg in messages:
            if msg.message_type != MessageType.TEXT:
                continue
            username = msg.user.username if msg.user else "Anonymous"
            full_text.append(f"{username}: {msg.content}")
        
        conversation_text = "\n".join(full_text)
        
        # Chunk the text
        chunks = []
        start = 0
        
        while start < len(conversation_text):
            end = start + chunk_size
            chunk = conversation_text[start:end]
            
            # Try to break at message boundary (newline)
            if end < len(conversation_text):
                last_newline = chunk.rfind('\n')
                if last_newline > chunk_size * 0.5:
                    end = start + last_newline + 1
                    chunk = conversation_text[start:end]
            
            chunks.append(chunk.strip())
            start = end - overlap
        
        return chunks
    
    @staticmethod
    def embed_recent_conversation(
        db: Session,
        group_id: int,
        hours_back: int = 24,
        chunk_size: int = 1000,
        overlap: int = 200,
        replace_old: bool = True
    ) -> List[ConversationChunk]:
        """
        Embed recent conversation as MULTIPLE chunks
        
        Returns list of all chunks created
        """
        # 1. Get recent messages
        since = datetime.utcnow() - timedelta(hours=hours_back)
        messages = db.query(StudyGroupMessage).filter(
            StudyGroupMessage.group_id == group_id,
            StudyGroupMessage.created_at >= since,
            StudyGroupMessage.message_type == MessageType.TEXT
        ).order_by(StudyGroupMessage.created_at.asc()).all()
        
        if not messages:
            return []
        
        # 2. Mark old chunks as inactive if replacing
        if replace_old:
            db.query(ConversationChunk).filter(
                ConversationChunk.group_id == group_id,
                ConversationChunk.is_active == True
            ).update({"is_active": False})
        
        # 3. Chunk the conversation
        chunks = ConversationEmbeddingService.chunk_conversation(
            messages, chunk_size, overlap
        )
        
        if not chunks:
            return []
        
        # 4. Generate embeddings in batch (efficient!)
        embeddings = embedding_service.embed_batch(chunks)
        
        # 5. Create batch ID to group these chunks
        batch_id = f"{group_id}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
        
        # 6. Store all chunks
        chunk_records = []
        for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_record = ConversationChunk(
                group_id=group_id,
                content=chunk_text,
                chunk_index=idx,
                window_start=messages[0].created_at,
                window_end=messages[-1].created_at,
                message_count=len(messages),
                embedding=embedding,
                batch_id=batch_id,
                is_active=True
            )
            db.add(chunk_record)
            chunk_records.append(chunk_record)
        
        db.commit()
        
        # Refresh all records
        for record in chunk_records:
            db.refresh(record)
        
        return chunk_records
    
    @staticmethod
    def search_conversations(
        db: Session,
        query_text: str,
        group_id: int,
        limit: int = 5,
        similarity_threshold: float = 0.65,
        active_only: bool = True
    ) -> List[ConversationChunk]:
        """
        Search conversation chunks by semantic similarity
        Returns the MOST RELEVANT chunks across all batches
        """
        # Generate query embedding
        query_embedding = embedding_service.embed_text(query_text)
        
        # Build query with filters
        query = db.query(ConversationChunk).filter(
            ConversationChunk.group_id == group_id
        )
        
        if active_only:
            query = query.filter(ConversationChunk.is_active == True)
        
        # Apply similarity threshold filter directly in the query
        # cosine_distance returns distance (0 = identical, 2 = opposite)
        # similarity = 1 - distance, so we filter where distance <= (1 - threshold)
        query = query.filter(
            ConversationChunk.embedding.cosine_distance(query_embedding) <= (1 - similarity_threshold)
        )
        
        # Order by distance (ascending = most similar first) and limit
        results = query.order_by(
            ConversationChunk.embedding.cosine_distance(query_embedding)
        ).limit(limit).all()
        
        return results
    
    @staticmethod
    def get_batch_info(
        db: Session,
        group_id: int,
        active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get info about all embedding batches
        Useful for debugging/monitoring
        """
        query = db.query(ConversationChunk).filter(
            ConversationChunk.group_id == group_id
        )
        
        if active_only:
            query = query.filter(ConversationChunk.is_active == True)
        
        chunks = query.all()
        
        # Group by batch_id
        batches = {}
        for chunk in chunks:
            if chunk.batch_id not in batches:
                batches[chunk.batch_id] = {
                    "batch_id": chunk.batch_id,
                    "chunk_count": 0,
                    "window_start": chunk.window_start,
                    "window_end": chunk.window_end,
                    "created_at": chunk.created_at
                }
            batches[chunk.batch_id]["chunk_count"] += 1
        
        return list(batches.values())
    
    @staticmethod
    def cleanup_old_chunks(
        db: Session,
        group_id: int,
        days_to_keep: int = 30
    ) -> int:
        """
        Delete old inactive conversation chunks to save space
        """
        cutoff = datetime.utcnow() - timedelta(days=days_to_keep)
        
        deleted = db.query(ConversationChunk).filter(
            ConversationChunk.group_id == group_id,
            ConversationChunk.is_active == False,
            ConversationChunk.created_at < cutoff
        ).delete()
        
        db.commit()
        return deleted
