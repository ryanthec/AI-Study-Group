"""
Teaching Assistant (TA) Agent Module
Uses Socratic prompting to enhance learning and critical thinking.
Integrates with RAG system for document and conversation context.
"""

from typing import Optional, Dict, Any, List, Iterator, AsyncIterator
from enum import Enum
from dataclasses import dataclass
import logging
import re

from .base_llm_model import BaseLLMModel
from ..services.rag_service import RAGConfig, RAGService

# Configure logging
logger = logging.getLogger(__name__)


class RAGMode(Enum):
    """Enum for RAG operating modes."""
    DISABLED = "disabled"
    DOCUMENTS_ONLY = "documents_only"
    CONVERSATIONS_ONLY = "conversations_only"
    BOTH = "both"

class QuestionDifficulty(Enum):
    """Difficulty levels to determine Socratic depth."""
    FACTUAL = "factual"  # Simple facts: "what is X?", "where is Y?"
    CONCEPTUAL = "conceptual"  # Concepts: "why", "how", "explain"
    APPLIED = "applied"  # Problems: "solve", "code", "math", "reasoning"
    COMPLEX = "complex"  # Multi-step: "compare", "analyze", "design"

@dataclass
class TAConfig:
    """Configuration for Teaching Assistant Agent."""
    rag_mode: RAGMode = RAGMode.DOCUMENTS_ONLY
    temperature: float = 0.7
    max_output_tokens: int = 2048
    top_p: float = 0.9
    top_k: int = 40
    
    # LLM difficulty check using classification prompt
    use_llm_difficulty_check: bool = True

    use_socratic_prompting: bool = True
    # Configurable Socratic prompt limits per difficulty
    socratic_prompt_limit_factual: int = 1  # "What is the largest country?" -> Just answer
    socratic_prompt_limit_conceptual: int = 2  # "Why does it rain?" -> 1-2 guiding questions then explain
    socratic_prompt_limit_applied: int = 2  # Coding/Math -> 1-2 hints then guide to answer
    socratic_prompt_limit_complex: int = 3  # Multi-step -> 2-3 questions to guide thinking
    
    enable_follow_ups: bool = True
    follow_up_probability: float = 0.2  # 20% chance of follow-up question
    
    # Minimum confidence to provide direct answer
    min_confidence_for_direct_answer: float = 0.7


# ========================
# System Prompts
# ========================

ADAPTIVE_SYSTEM_PROMPT = """You are an expert Teaching Assistant with a balanced approach to helping students learn.

YOUR TEACHING PHILOSOPHY:
- Adapt your response based on the question type and student level
- For factual questions: Provide clear, direct answers
- For conceptual questions: Start with a guiding question, then explain concepts
- For problem-solving: Provide hints and guide the student to solve it themselves
- Build confidence by validating correct thinking and gently correcting misconceptions

QUESTION-SPECIFIC STRATEGIES:

For FACTUAL questions (e.g., "What is...?", "Where is...?", "When did...?"):
1. Provide the direct answer clearly.
2. Add brief context to help understanding.
3. Suggest related concepts if appropriate.
4. IMPORTANT: End your response by asking if the user wants details on a specific related aspect.
Format: "The answer is X. ... Would you like to know more about [specific attribute, e.g., habitat/history/usage]?"

For CONCEPTUAL questions (e.g., "Why...?", "How does...?", "Explain..."):
1. Optional: Ask ONE clarifying question to understand their level.
2. Explain the concept with analogies and examples.
3. Connect to their existing knowledge.
Format: "Before I explain, what do you already know about X? [After their response: Here's how it works...]"

For PROBLEM-SOLVING (e.g., coding, math, reasoning):
1. Ask ONE guiding question to understand their approach.
2. Provide hints without giving the answer.
3. Guide them toward the solution.
Format: "I can help! Have you considered...? Here's a hint: ... Try applying this..."
*If your explanation becomes long or detailed, conclude by asking: "Would you like a quick summary of this approach?"*

For COMPLEX questions (Analysis, Design, Multi-step):
1. Break down the problem.
2. Discuss trade-offs or perspectives.
3. *If the response is extensive (more than 3 paragraphs), conclude by asking: "This was a detailed explanation. Would you like a brief summary?"*

For VALIDATION (e.g., "Is Russia the largest country?"):
- Simply confirm or correct.
- Brief explanation of why.

TONE & STYLE:
- Be encouraging and supportive.
- Use clear, accessible language.
- Keep responses focused.
- Show enthusiasm for learning.
"""

# Specific prompt for the classifier agent
CLASSIFICATION_SYSTEM_PROMPT = """You are a precise classifier. 
Categorize the user's question into exactly one of these 4 categories:
1. FACTUAL (Simple facts, definitions, list requests)
2. CONCEPTUAL (Explanations, 'how'/'why' questions, comparisons)
3. APPLIED (Coding, math, debugging, solving specific problems)
4. COMPLEX (Design, analysis, open-ended evaluation)

Return ONLY the category name (e.g., "FACTUAL"). Do not add punctuation or explanation."""


FOLLOW_UP_TEMPLATE = """Great question! Before I explain {topic}, what do you already know about it? 
This will help me pitch my explanation at the right level for you."""


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
            rag_service: Optional RAG service instance
            config: Optional TAConfig for customization
        """
        self.base_llm = base_llm
        self.rag_service = rag_service
        self.config = config or TAConfig()
        
        logger.info(
            f"Initialized TeachingAssistantAgent with RAG mode: {self.config.rag_mode.value}"
        )
    

    # ========================
    # Question Analysis
    # ========================

    async def _classify_with_llm(self, question: str) -> QuestionDifficulty:
        """Second-level check using a fast LLM call."""
        try:
            response = await self.base_llm.generate_stateless_response(
                prompt=f"Question: {question}",
                system_prompt=CLASSIFICATION_SYSTEM_PROMPT,
                max_output_tokens=10,
                temperature=0.0
            )
            
            category = response.strip().upper()
            
            if "FACTUAL" in category: return QuestionDifficulty.FACTUAL
            if "CONCEPTUAL" in category: return QuestionDifficulty.CONCEPTUAL
            if "APPLIED" in category: return QuestionDifficulty.APPLIED
            if "COMPLEX" in category: return QuestionDifficulty.COMPLEX
            
            return QuestionDifficulty.CONCEPTUAL # Default fallback
            
        except Exception as e:
            logger.error(f"LLM classification failed: {e}")
            return QuestionDifficulty.CONCEPTUAL

    async def _detect_question_difficulty(self, question: str) -> QuestionDifficulty:
        """
        Detect question difficulty using Hybrid approach:
        1. Fast Regex check for obvious signals (Code, Math).
        2. LLM check for ambiguous/natural language questions (if enabled).
        """
        question_lower = question.lower().strip()
        
        # 1. Strong Regex Signals (Keep these as they are fast and usually correct)
        
        # APPLIED - Code/Math keywords are usually distinct
        applied_patterns = [
            r'code\s+',
            r'write\s+.*\s+function',
            r'solve\s+',
            r'calculate\s+',
            r'implement\s+',
            r'debug\s+',
            r'fix\s+',
            r'algorithm\s+',
            r'error\s+',]
        for pattern in applied_patterns:
            if re.search(pattern, question_lower):
                return QuestionDifficulty.APPLIED
        
        # 2. If config allows, use LLM for the rest (Factual vs Conceptual is hard for Regex)
        if self.config.use_llm_difficulty_check:
            return await self._classify_with_llm(question)
            
        # 3. Fallback to Regex if LLM check disabled
        # COMPLEX
        complex_patterns = [
            r'^analyze\s+',
            r'^design\s+',
            r'^evaluate\s+',
            r'^what\s+would\s+happen',
            r'^how\s+would\s+you\s+',
            r'^suggest\s+',
            r'^hypothesize\s+',]
        for pattern in complex_patterns:
            if re.search(pattern, question_lower):
                return QuestionDifficulty.COMPLEX
        
        # FACTUAL vs CONCEPTUAL (Regex is often weak here, hence LLM preference above)
        factual_patterns = [
            r'^what\s+is\s+',
            r'^what\s+are\s+',
            r'^where\s+is\s+',
            r'^when\s+did\s+',
            r'^who\s+is\s+',
            r'^which\s+.*\?$',
            r'^define\s+',
            r'^list\s+',
            r'is\s+.*\s+the\s+',]
        for pattern in factual_patterns:
            if re.search(pattern, question_lower):
                return QuestionDifficulty.FACTUAL
                
        return QuestionDifficulty.CONCEPTUAL
    
    # Old Regex-only method retained for reference
    # def _detect_question_difficulty(self, question: str) -> QuestionDifficulty:
    #     """
    #     Detect question difficulty based on patterns.
        
    #     Args:
    #         question: The student's question
            
    #     Returns:
    #         QuestionDifficulty enum value
    #     """
    #     question_lower = question.lower().strip()
        
    #     # FACTUAL - Direct information requests
    #     factual_patterns = [
    #         r'^what\s+is\s+',
    #         r'^what\s+are\s+',
    #         r'^where\s+is\s+',
    #         r'^when\s+did\s+',
    #         r'^who\s+is\s+',
    #         r'^which\s+.*\?$',
    #         r'^define\s+',
    #         r'^list\s+',
    #         r'is\s+.*\s+the\s+',  # "Is Russia the largest country?"
    #     ]
        
    #     # CONCEPTUAL - Understanding & explanation
    #     conceptual_patterns = [
    #         r'^why\s+',
    #         r'^how\s+.*\s+work',
    #         r'^explain\s+',
    #         r'^describe\s+',
    #         r'^what\s+is\s+the\s+difference',
    #         r'^compare\s+',
    #     ]
        
    #     # APPLIED - Problem solving & coding
    #     applied_patterns = [
    #         r'code\s+',
    #         r'write\s+.*\s+function',
    #         r'solve\s+',
    #         r'calculate\s+',
    #         r'implement\s+',
    #         r'debug\s+',
    #         r'fix\s+',
    #         r'algorithm\s+',
    #         r'error\s+',
    #     ]
        
    #     # COMPLEX - Multi-step analysis
    #     complex_patterns = [
    #         r'^analyze\s+',
    #         r'^design\s+',
    #         r'^evaluate\s+',
    #         r'^what\s+would\s+happen',
    #         r'^how\s+would\s+you\s+',
    #         r'^suggest\s+',
    #         r'^hypothesize\s+',
    #     ]
        
    #     # Check patterns in order (more specific first)
    #     for pattern in applied_patterns:
    #         if re.search(pattern, question_lower):
    #             return QuestionDifficulty.APPLIED
        
    #     for pattern in complex_patterns:
    #         if re.search(pattern, question_lower):
    #             return QuestionDifficulty.COMPLEX
        
    #     for pattern in conceptual_patterns:
    #         if re.search(pattern, question_lower):
    #             return QuestionDifficulty.CONCEPTUAL
        
    #     for pattern in factual_patterns:
    #         if re.search(pattern, question_lower):
    #             return QuestionDifficulty.FACTUAL
        
    #     # Default to conceptual for ambiguous questions
    #     return QuestionDifficulty.CONCEPTUAL

    def _get_socratic_prompt_limit(self, difficulty: QuestionDifficulty) -> int:
        """
        Get the Socratic prompt limit based on question difficulty.
        
        Args:
            difficulty: QuestionDifficulty enum value
            
        Returns:
            Maximum number of Socratic prompts for this difficulty
        """
        limits = {
            QuestionDifficulty.FACTUAL: self.config.socratic_prompt_limit_factual,
            QuestionDifficulty.CONCEPTUAL: self.config.socratic_prompt_limit_conceptual,
            QuestionDifficulty.APPLIED: self.config.socratic_prompt_limit_applied,
            QuestionDifficulty.COMPLEX: self.config.socratic_prompt_limit_complex,
        }
        return limits.get(difficulty, 2)

    def _build_adaptive_system_prompt(
        self,
        difficulty: QuestionDifficulty,
        prompt_limit: int
    ) -> str:
        """
        Build an adaptive system prompt based on question difficulty.
        
        Args:
            difficulty: Detected question difficulty
            prompt_limit: Maximum Socratic prompts for this difficulty
            
        Returns:
            Customized system prompt
        """
        # If factual question and limit is 1, instruct model to give direct answer
        if difficulty == QuestionDifficulty.FACTUAL and prompt_limit == 1:
            return f"""{ADAPTIVE_SYSTEM_PROMPT}

            IMPORTANT FOR THIS QUESTION:
            This appears to be a factual question requiring direct information.
            Respond with a clear, direct answer followed by brief context.
            Do NOT ask clarifying questions or probe for more information.
            Keep response concise and informative."""
        
        return ADAPTIVE_SYSTEM_PROMPT



    # ========================
    # Core Functionality
    # ========================
    
    async def answer_question(
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
        Answer a student's question using adaptive Socratic prompting and optional RAG.

        Args:
            session_id: Chat session ID (tied to study group)
            group_id: Study group ID for RAG context
            question: Student's question
            use_rag: Whether to use RAG for context
            db_session: Database session for RAG (required if use_rag=True and RAG mode is not DISABLED)
            custom_temperature: Optional temperature override
            custom_top_p: Optional top_p override
            custom_top_k: Optional top_k override

        Returns:
            AI-generated response with optional RAG context

        Raises:
            ValueError: If RAG is needed but not properly configured
        """
        # Detect question difficulty
        difficulty = await self._detect_question_difficulty(question)
        prompt_limit = self._get_socratic_prompt_limit(difficulty)
        
        # Build adaptive system prompt
        system_prompt = self._build_adaptive_system_prompt(difficulty, prompt_limit)

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

        response = await self.base_llm.generate_response(
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

    async def answer_question_stream(
        self,
        session_id: str,
        group_id: int,
        question: str,
        use_rag: bool = True,
        db_session=None,
        custom_temperature: Optional[float] = None,
        custom_top_p: Optional[float] = None,
        custom_top_k: Optional[float] = None,
    ) -> AsyncIterator[str]:
        """
        Answer a student's question using adaptive Socratic prompting and optional RAG (streaming).

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
        # Detect question difficulty
        difficulty = await self._detect_question_difficulty(question)
        prompt_limit = self._get_socratic_prompt_limit(difficulty)
        
        # Build adaptive system prompt
        system_prompt = self._build_adaptive_system_prompt(difficulty, prompt_limit)

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

        async for chunk in self.base_llm.generate_response_stream(
            session_id=session_id,
            user_message=user_message,
            system_prompt=system_prompt,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            max_output_tokens=self.config.max_output_tokens,
            use_chat_history=True
        ):
            yield chunk

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
            f"Based on study materials:\n{formatted_context}\n\n"
            f"Student Question: {question}"
        )

        return enhanced_message
    
    # ========================
    # Configuration Management
    # ========================
    
    def set_socratic_prompt_limit(
        self,
        difficulty: QuestionDifficulty,
        limit: int
    ) -> None:
        """
        Set Socratic prompt limit for a specific difficulty level.
        
        Args:
            difficulty: QuestionDifficulty enum
            limit: Maximum number of Socratic prompts (0-5 recommended)
        """
        if not 0 <= limit <= 5:
            raise ValueError("Socratic prompt limit must be between 0 and 5")
        
        limits = {
            QuestionDifficulty.FACTUAL: "socratic_prompt_limit_factual",
            QuestionDifficulty.CONCEPTUAL: "socratic_prompt_limit_conceptual",
            QuestionDifficulty.APPLIED: "socratic_prompt_limit_applied",
            QuestionDifficulty.COMPLEX: "socratic_prompt_limit_complex",
        }
        
        attr = limits[difficulty]
        setattr(self.config, attr, limit)
        logger.info(f"Socratic prompt limit for {difficulty.value} set to {limit}")

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
            "socratic_limits": {
                "factual": self.config.socratic_prompt_limit_factual,
                "conceptual": self.config.socratic_prompt_limit_conceptual,
                "applied": self.config.socratic_prompt_limit_applied,
                "complex": self.config.socratic_prompt_limit_complex,
            },
            "active_sessions": len(self.base_llm.sessions)
        }