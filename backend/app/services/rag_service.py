from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from .document_service import DocumentService
from .conversation_embedding_service import ConversationEmbeddingService


@dataclass
class RAGConfig:
    """Configuration for RAG retrieval"""
    include_documents: bool = True
    include_conversations: bool = True
    top_k_documents: int = 3
    top_k_conversations: int = 3
    similarity_threshold: float = 0.5
    embed_conversations_first: bool = False  # If True, embed recent conversations before searching
    hours_back: int = 24  # For conversation embedding
    max_doc_chars: int = 2000  # For prompt formatting
    max_conv_chars: int = 1500  # For prompt formatting


class RAGService:
    
    @staticmethod
    def retrieve_context(
        db: Session,
        query: str,
        group_id: int,
        config: Optional[RAGConfig] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Unified RAG retrieval with flexible configuration
        
        Args:
            db: Database session
            query: User's query
            group_id: Study group ID
            config: RAG configuration (uses default if None)
        
        Returns:
            Dictionary with "documents" and "conversations" lists
        """
        # Use default config if none provided
        if config is None:
            config = RAGConfig()
        
        context: Dict[str, List[Dict[str, Any]]] = {
            "documents": [],
            "conversations": []
        }
        
        # Optionally embed recent conversations first
        if config.embed_conversations_first and config.include_conversations:
            try:
                ConversationEmbeddingService.embed_recent_conversation(
                    db=db,
                    group_id=group_id,
                    hours_back=config.hours_back,
                    replace_old=True
                )
            except Exception as e:
                print(f"Failed to embed conversations: {e}")
                # Continue even if embedding fails
        
        # Retrieve from documents
        if config.include_documents:
            try:
                doc_chunks = DocumentService.similarity_search(
                    db=db,
                    query_text=query,
                    group_id=group_id,
                    limit=config.top_k_documents,
                    similarity_threshold=config.similarity_threshold
                )
                
                for chunk in doc_chunks:
                    context["documents"].append({
                        "content": chunk.content,
                        "type": "document",
                        "source": chunk.document.filename if chunk.document else "Unknown",
                        "document_id": chunk.document_id,
                        "chunk_index": chunk.chunk_index
                    })
            except Exception as e:
                print(f"Failed to retrieve documents: {e}")
        
        # Retrieve from conversations
        if config.include_conversations:
            try:
                conv_chunks = ConversationEmbeddingService.search_conversations(
                    db=db,
                    query_text=query,
                    group_id=group_id,
                    limit=config.top_k_conversations,
                    similarity_threshold=config.similarity_threshold
                )
                
                for chunk in conv_chunks:
                    context["conversations"].append({
                        "content": chunk.content,
                        "type": "conversation",
                        "source": f"Chat ({chunk.window_start.strftime('%b %d')} - {chunk.window_end.strftime('%b %d')})",
                        "chunk_index": chunk.chunk_index,
                        "batch_id": chunk.batch_id
                    })
            except Exception as e:
                print(f"Failed to retrieve conversations: {e}")
        
        return context
    
    @staticmethod
    def format_context_for_prompt(
        context: Dict[str, List[Dict[str, Any]]],
        config: Optional[RAGConfig] = None
    ) -> str:
        """
        Format retrieved context into a prompt-friendly string,
        grouping chunks by their source document to prevent citation hallucinations.
        """
        if config is None:
            config = RAGConfig()
        
        formatted = ""
        
        # Format document context - GROUPED BY SOURCE
        if context.get("documents"):
            formatted += "📚 Study Materials:\n"
            
            # 1. Group the chunks by filename
            grouped_docs: Dict[str, List[str]] = {}
            for doc in context["documents"]:
                source = doc['source']
                if source not in grouped_docs:
                    grouped_docs[source] = []
                grouped_docs[source].append(doc['content'])
                
            # 2. Format the grouped chunks
            for source, chunks in grouped_docs.items():
                formatted += f"\n[Source Document: {source}]\n"
                for idx, chunk_content in enumerate(chunks, 1):
                    content = chunk_content[:config.max_doc_chars]
                    if len(chunk_content) > config.max_doc_chars:
                        content += "..."
                    formatted += f"--- Excerpt {idx} ---\n{content}\n"
        
        # Format conversation context
        if context.get("conversations"):
            formatted += "\n💬 Past Discussions:\n"
            for idx, conv in enumerate(context["conversations"], 1):
                formatted += f"\n[Discussion {idx}: {conv['source']}]\n"
                content = conv['content'][:config.max_conv_chars]
                if len(conv['content']) > config.max_conv_chars:
                    content += "..."
                formatted += f"{content}\n"
        
        if not formatted:
            formatted = "No relevant context found.\n"
        
        return formatted
    
    @staticmethod
    def build_rag_prompt(query: str, context: str) -> str:
        """Build a complete RAG prompt with context and query"""
        prompt = f"""You are a helpful study assistant. Use the following context from study materials to answer the question. If the context doesn't contain relevant information, say so.

Context:
{context}

Question: {query}

Answer:"""
        return prompt

rag_service = RAGService()
