"""
Teaching Assistant (TA) Agent Module
Uses Socratic prompting to enhance learning and critical thinking.
Integrates with RAG system for document and conversation context.
"""

from typing import Optional, Dict, Any, List, Iterator
from enum import Enum
from dataclasses import dataclass
import logging

from base_llm_model import BaseLLMModel
from ..services.rag_service import RAGConfig, RAGService

# Configure logging
logger = logging.getLogger(__name__)


class RAGMode(Enum):
    """Enum for RAG operating modes."""
    DISABLED = "disabled"
    DOCUMENTS_ONLY = "documents_only"
    CONVERSATIONS_ONLY = "conversations_only"
    BOTH = "both"


@dataclass
class TAConfig:
    """Configuration for Teaching Assistant Agent."""
    rag_mode: RAGMode = RAGMode.DOCUMENTS_ONLY
    temperature: float = 0.7
    max_output_tokens: int = 2048
    top_p: float = 0.9
    top_k: int = 40
    use_socratic_prompting: bool = True
    enable_follow_ups: bool = True
    follow_up_probability: float = 0.3  # 30% chance of follow-up
    socratic_depth: int = 2  # Number of follow-up questions


# ========================
# System Prompts
# ========================

SOCRATIC_SYSTEM_PROMPT = """You are an expert Teaching Assistant with a passion for helping students develop critical thinking skills. 

Your teaching philosophy:
- Use Socratic prompting to guide students to their own understanding
- Ask clarifying questions rather than immediately providing answers
- Help students identify gaps in their reasoning
- Encourage deeper exploration of concepts
- Be supportive and patient while maintaining high academic standards

When answering questions:
1. First, understand what the student already knows by asking clarifying questions
2. Guide them with leading questions that help them think through the problem
3. Provide hints and point them toward relevant concepts from their study materials
4. Only provide direct answers when the student has exhausted their thinking or needs validation
5. After providing an answer, ask follow-up questions to deepen understanding

Format your responses clearly with:
- Questions to probe understanding
- Hints that guide thinking
- Brief explanations when needed
- Connections to their study materials when relevant
- Encouragement for their learning journey

Remember: The goal is not to give answers, but to help students become independent learners."""

DEFAULT_SYSTEM_PROMPT = """You are an expert Teaching Assistant designed to help students learn and understand complex concepts.

Your approach:
- Explain concepts clearly and patiently
- Provide examples when helpful
- Connect new information to foundational knowledge
- Encourage questions and deeper exploration
- Support student learning through clear, structured responses

When answering questions:
1. Understand the student's current level and what they're trying to learn
2. Break down complex concepts into manageable parts
3. Use relevant study materials when available
4. Provide clear explanations with examples
5. Suggest ways to practice or explore the concept further

Maintain a supportive and professional tone while being thorough and accurate."""

RAG_CONTEXT_TEMPLATE = """Based on the study materials available, here's relevant context:

{context}

---

Using this context, I'll help you understand the concept better."""


# ========================
# Teaching Assistant Agent
# ========================

class TeachingAssistantAgent:
    """
    AI Teaching Assistant Agent with Socratic prompting and optional RAG support.
    
    Features:
    - Session-based chat history isolated by study group
    - Socratic prompting for enhanced learning
    - Flexible RAG integration (documents only, conversations only, or both)
    - Optional RAG usage (can be turned on/off)
    - Modular design for reuse across projects
    """
    
    def __init__(
        self,
        base_llm: BaseLLMModel,
        rag_service=None,
        config: Optional[TAConfig] = None
    ):
        """
        Initialize the Teaching Assistant Agent.
        
        Args:
            base_llm: BaseLLMModel instance for LLM operations
            rag_service: Optional RAG service instance (from your rag_service.py)
            config: Optional TAConfig for customization
        """
        self.base_llm = base_llm
        self.rag_service = rag_service
        self.config = config or TAConfig()
        
        logger.info(
            f"Initialized TeachingAssistantAgent with RAG mode: {self.config.rag_mode.value}"
        )
    
    # ========================
    # Core Functionality
    # ========================
    
    def answer_question(
        self,
        session_id: str,
        group_id: int,
        question: str,
        use_rag: bool = True,
        db_session=None,
        custom_temperature: Optional[float] = None,
        custom_top_p: Optional[float] = None,
        custom_top_k: Optional[float] = None,
    ) -> str:
        """
        Answer a student's question using Socratic prompting and optional RAG.
        
        Args:
            session_id: Chat session ID (tied to study group)
            group_id: Study group ID for RAG context
            question: Student's question
            use_rag: Whether to use RAG for context
            db_session: Database session for RAG (required if use_rag=True and RAG mode is not DISABLED)
            custom_temperature: Optional temperature override
            
        Returns:
            AI-generated response with optional RAG context
            
        Raises:
            ValueError: If RAG is needed but not properly configured
        """
        
        # Prepare system prompt
        system_prompt = (
            SOCRATIC_SYSTEM_PROMPT 
            if self.config.use_socratic_prompting 
            else DEFAULT_SYSTEM_PROMPT
        )
        
        # Prepare user message with optional RAG context
        user_message = question
        
        if use_rag and self.config.rag_mode != RAGMode.DISABLED:
            if self.rag_service is None:
                logger.warning("RAG requested but service not configured, proceeding without RAG")
            elif db_session is None:
                logger.warning("RAG requested but db_session not provided, proceeding without RAG")
            else:
                try:
                    user_message = self._prepare_message_with_rag(
                        question, group_id, db_session
                    )
                except Exception as e:
                    logger.error(f"RAG retrieval failed: {str(e)}, proceeding without RAG")
        
        # Generate response
        temperature = custom_temperature or self.config.temperature
        top_p = custom_top_p or self.config.top_p
        top_k = custom_top_k or self.config.top_k
        response = self.base_llm.generate_response(
            session_id=session_id,
            user_message=user_message,
            system_prompt=system_prompt,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            max_output_tokens=self.config.max_output_tokens,
            use_chat_history=True
        )
        
        return response
    
    
    def answer_question_stream(
        self,
        session_id: str,
        group_id: int,
        question: str,
        use_rag: bool = True,
        db_session=None,
        custom_temperature: Optional[float] = None,
        custom_top_p: Optional[float] = None,
        custom_top_k: Optional[float] = None,
    ) -> Iterator[str]:
        """
        Answer a student's question using Socratic prompting and optional RAG (streaming).
        
        Yields text deltas as they are generated. RAG retrieval happens once before streaming begins.
        
        Args:
            session_id: Chat session ID (tied to study group)
            group_id: Study group ID for RAG context
            question: Student's question
            use_rag: Whether to use RAG for context
            db_session: Database session for RAG (required if use_rag=True and RAG mode is not DISABLED)
            custom_temperature: Optional temperature override
            custom_top_p: Optional top_p override
            custom_top_k: Optional top_k override
            
        Yields:
            Text deltas as the response is generated
            
        Raises:
            ValueError: If RAG is needed but not properly configured
        """
        
        # Prepare system prompt
        system_prompt = (
            SOCRATIC_SYSTEM_PROMPT 
            if self.config.use_socratic_prompting 
            else DEFAULT_SYSTEM_PROMPT
        )
        
        # Prepare user message with optional RAG context
        user_message = question
        
        if use_rag and self.config.rag_mode != RAGMode.DISABLED:
            if self.rag_service is None:
                logger.warning("RAG requested but service not configured, proceeding without RAG")
            elif db_session is None:
                logger.warning("RAG requested but db_session not provided, proceeding without RAG")
            else:
                try:
                    user_message = self._prepare_message_with_rag(
                        question, group_id, db_session
                    )
                except Exception as e:
                    logger.error(f"RAG retrieval failed: {str(e)}, proceeding without RAG")
        
        # Generate response
        temperature = custom_temperature or self.config.temperature
        top_p = custom_top_p or self.config.top_p
        top_k = custom_top_k or self.config.top_k

        yield from self.base_llm.generate_response_stream(
            session_id=session_id,
            user_message=user_message,
            system_prompt=system_prompt,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            max_output_tokens=self.config.max_output_tokens,
            use_chat_history=True
        )
        

    def _prepare_message_with_rag(
        self,
        question: str,
        group_id: int,
        db_session
    ) -> str:
        """
        Retrieve relevant context using RAG and prepare enhanced message.
        
        Args:
            question: Original question
            group_id: Study group ID
            db_session: Database session
            
        Returns:
            Question with RAG context prepended
        """
        
        # Configure RAG based on agent config
        rag_config = RAGConfig(
            include_documents=(
                self.config.rag_mode in [RAGMode.DOCUMENTS_ONLY, RAGMode.BOTH]
            ),
            include_conversations=(
                self.config.rag_mode in [RAGMode.CONVERSATIONS_ONLY, RAGMode.BOTH]
            ),
            top_k_documents=3,
            top_k_conversations=3
        )
        
        # Retrieve context
        context_dict = RAGService.retrieve_context(
            db=db_session,
            query=question,
            group_id=group_id,
            config=rag_config
        )
        
        # Format context for prompt
        formatted_context = RAGService.format_context_for_prompt(
            context=context_dict,
            config=rag_config
        )
        
        # Prepare enhanced message
        enhanced_message = (
            f"{RAG_CONTEXT_TEMPLATE.format(context=formatted_context)}\n\n"
            f"Student Question: {question}"
        )
        
        return enhanced_message
    
    # ========================
    # RAG Configuration
    # ========================
    
    def set_rag_mode(self, rag_mode: RAGMode) -> None:
        """
        Change RAG mode for the agent.
        
        Args:
            rag_mode: New RAG mode (DISABLED, DOCUMENTS_ONLY, CONVERSATIONS_ONLY, or BOTH)
        """
        self.config.rag_mode = rag_mode
        logger.info(f"RAG mode changed to: {rag_mode.value}")
    
    def enable_rag(self) -> None:
        """Enable RAG with documents only."""
        self.set_rag_mode(RAGMode.DOCUMENTS_ONLY)
    
    def disable_rag(self) -> None:
        """Disable RAG."""
        self.set_rag_mode(RAGMode.DISABLED)
    
    def is_rag_enabled(self) -> bool:
        """Check if RAG is currently enabled."""
        return self.config.rag_mode != RAGMode.DISABLED
    
    # ========================
    # Configuration Management
    # ========================
    
    def set_socratic_mode(self, enabled: bool) -> None:
        """Enable or disable Socratic prompting."""
        self.config.use_socratic_prompting = enabled
        logger.info(f"Socratic mode: {'enabled' if enabled else 'disabled'}")
    
    def set_temperature(self, temperature: float) -> None:
        """Set default temperature for responses."""
        if not 0 <= temperature <= 2:
            raise ValueError("Temperature must be between 0 and 2")
        self.config.temperature = temperature
        logger.info(f"Temperature set to: {temperature}")
    
    def set_max_tokens(self, max_tokens: int) -> None:
        """Set maximum tokens for responses."""
        if max_tokens < 1:
            raise ValueError("max_tokens must be at least 1")
        self.config.max_output_tokens = max_tokens
        logger.info(f"Max tokens set to: {max_tokens}")
    
    def get_config(self) -> TAConfig:
        """Get current agent configuration."""
        return self.config
    
    # ========================
    # Session Management (delegated to BaseLLMModel)
    # ========================
    
    def create_session(
        self,
        session_id: str,
        group_id: int,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Create a new chat session for a study group.
        
        Args:
            session_id: Unique session identifier
            group_id: Study group ID for isolation
            metadata: Optional metadata
            
        Returns:
            Created ChatSession object
        """
        return self.base_llm.create_session(
            session_id=session_id,
            group_id=group_id,
            metadata=metadata
        )
    
    def get_session_history(self, session_id: str) -> Optional[List[Dict[str, str]]]:
        """Get chat history for a session."""
        return self.base_llm.get_session_history(session_id)
    
    def clear_session(self, session_id: str) -> bool:
        """Clear chat history for a session."""
        return self.base_llm.clear_session_history(session_id)
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a chat session completely."""
        return self.base_llm.delete_session(session_id)
    
    def list_group_sessions(self, group_id: int) -> List:
        """List all sessions for a study group."""
        return self.base_llm.list_sessions(group_id=group_id)
    
    # ========================
    # Utility Methods
    # ========================
    
    def get_status(self) -> Dict[str, Any]:
        """Get current agent status and configuration."""
        return {
            "rag_enabled": self.is_rag_enabled(),
            "rag_mode": self.config.rag_mode.value,
            "socratic_prompting": self.config.use_socratic_prompting,
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_output_tokens,
            "active_sessions": len(self.base_llm.sessions)
        }