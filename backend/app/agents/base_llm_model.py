import os
from typing import Optional, List, Dict, Any, Iterator
from abc import ABC, abstractmethod
from datetime import datetime
from dataclasses import dataclass, field
import json
import logging

from google import genai
from google.genai import types

from dotenv import load_dotenv
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)


@dataclass
class ChatSession:
    """
    Represents an isolated chat session tied to a study group or context.
    Maintains chat history independent of other sessions.
    """
    session_id: str
    group_id: int
    created_at: datetime = field(default_factory=datetime.utcnow)
    chat_history: List[Dict[str, str]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_message(self, role: str, content: str) -> None:
        """Add a message to the chat history."""
        self.chat_history.append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def get_history(self) -> List[Dict[str, str]]:
        """Get chat history without timestamps for API calls."""
        return [
            {"role": msg["role"], "content": msg["content"]}
            for msg in self.chat_history
        ]
    
    def clear_history(self) -> None:
        """Clear chat history for this session."""
        self.chat_history = []
    
    def get_summary(self) -> Dict[str, Any]:
        """Get session summary information."""
        return {
            "session_id": self.session_id,
            "group_id": self.group_id,
            "created_at": self.created_at.isoformat(),
            "message_count": len(self.chat_history),
            "metadata": self.metadata
        }


class BaseLLMModel:
    """
    Modular Base LLM Model for Google Gemini 2.5 Flash API.
    
    Features:
    - Multi-session support with group isolation
    - Customizable system prompts
    - Temperature and other parameter control
    - Error handling and logging
    - Easy integration with other agents
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "gemini-2.5-flash",
        default_temperature: float = 0.7,
        top_p: float = 0.9,
        top_k: float = 40,
        max_output_tokens: Optional[int] = None,
        timeout: int = 60,
        max_sessions: int = 100
    ):
        """
        Initialize the Base LLM Model.
        
        Args:
            api_key: Google API key. If None, uses GOOGLE_API_KEY env var.
            model_name: Name of the model to use
            default_temperature: Default temperature for responses
            max_sessions: Maximum number of concurrent sessions
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not provided and not found in environment")
        
        self.client = genai.Client(api_key=self.api_key)
        self.model_name = model_name
        self.default_temperature = default_temperature
        self.top_p = top_p
        self.top_k = top_k
        self.max_output_tokens = max_output_tokens
        self.timeout = timeout
        self.max_sessions = max_sessions
        
        # Session storage: {session_id: ChatSession}
        self.sessions: Dict[str, ChatSession] = {}
        
        logger.info(f"Initialized BaseLLMModel with model: {model_name}")
    
    # ========================
    # Session Management
    # ========================
    
    def create_session(
        self,
        session_id: str,
        group_id: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ChatSession:
        """
        Create a new chat session tied to a study group.
        
        Args:
            session_id: Unique session identifier
            group_id: Study group ID for isolation
            metadata: Optional metadata for the session
            
        Returns:
            Created ChatSession object
            
        Raises:
            RuntimeError: If max sessions reached
        """
        if len(self.sessions) >= self.max_sessions:
            logger.warning(f"Max sessions ({self.max_sessions}) reached")
            raise RuntimeError(f"Maximum sessions ({self.max_sessions}) reached")
        
        if session_id in self.sessions:
            logger.warning(f"Session {session_id} already exists, returning existing")
            return self.sessions[session_id]
        
        session = ChatSession(
            session_id=session_id,
            group_id=group_id,
            metadata=metadata or {}
        )
        self.sessions[session_id] = session
        logger.info(f"Created session {session_id} for group {group_id}")
        return session
    
    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """Get an existing chat session."""
        return self.sessions.get(session_id)
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a chat session and clear its history."""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Deleted session {session_id}")
            return True
        return False
    
    def list_sessions(self, group_id: Optional[int] = None) -> List[ChatSession]:
        """
        List all sessions, optionally filtered by group.
        
        Args:
            group_id: Optional group ID to filter sessions
            
        Returns:
            List of ChatSession objects
        """
        if group_id is None:
            return list(self.sessions.values())
        return [s for s in self.sessions.values() if s.group_id == group_id]
    
    # ========================
    # Core LLM Functionality
    # ========================
    
    # Helper to build contents from session history
    def build_contents_for_session(
        self,
        session: ChatSession,
        user_message: str,
        use_chat_history: bool
    ) -> list[types.Content]:
        contents: list[types.Content] = []
        if use_chat_history and len(session.chat_history) > 1:
            for msg in session.chat_history:
                role = msg["role"]
                text = msg["content"]
                if role == "user":
                    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=text)]))
                elif role == "assistant":
                    contents.append(types.Content(role="model", parts=[types.Part.from_text(text=text)]))
        else:
            contents = [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=user_message)]
                )
            ]
        return contents
    
    def generate_response(
        self,
        session_id: str,
        user_message: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[float] = None,
        max_output_tokens: Optional[int] = 2048,
        timeout: Optional[int] = None,
        use_chat_history: bool = True
    ) -> str:
        """
        Generate a response from the LLM.
        
        Args:
            session_id: Session ID for chat history isolation
            user_message: User's input message
            system_prompt: Optional system prompt to guide model behavior
            temperature: Temperature for response generation (overrides default)
            max_tokens: Maximum tokens in response
            use_chat_history: Whether to use chat history from session
            
        Returns:
            Generated response text
            
        Raises:
            ValueError: If session not found
            RuntimeError: If API call fails
        """
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        
        # Add user message to history
        session.add_message("user", user_message)
        
        try:
            # Build contents for API call
            contents = self.build_contents_for_session(
                session=session,
                user_message=user_message,
                use_chat_history=use_chat_history
            )
            
            # Prepare generation config
            config_params: Dict[str, Any] = {
                "temperature": temperature if temperature is not None else self.default_temperature,
                "top_p": top_p if top_p is not None else self.top_p,
                "top_k": top_k if top_k is not None else self.top_k,
            }
            
            if max_output_tokens is not None:
                config_params["max_output_tokens"] = max_output_tokens
            elif self.max_output_tokens is not None:
                config_params["max_output_tokens"] = self.max_output_tokens
            
            if system_prompt:
                config_params["system_instruction"] = system_prompt
            
            generation_config = types.GenerateContentConfig(**config_params)
            
            # Generate response using the new SDK
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=generation_config
            )
            
            # Extract response text
            response_text = response.text if response.text else ""
            
            # Add assistant response to history
            session.add_message("assistant", response_text)
            
            logger.info(f"Generated response for session {session_id}")
            return response_text
            
        except Exception as e:
            # Log error but still save user message
            logger.error(f"Error generating response: {str(e)}")
            raise RuntimeError(f"Failed to generate response: {str(e)}")
    
    def generate_response_with_context(
        self,
        session_id: str,
        user_message: str,
        context: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[float] = None,
        max_output_tokens: Optional[int] = 2048,
        timeout: Optional[int] = None,
    ) -> str:
        """
        Generate a response with additional context (useful for RAG).
        
        Args:
            session_id: Session ID for chat history isolation
            user_message: User's input message
            context: Additional context to include (e.g., from RAG)
            system_prompt: Optional system prompt
            temperature: Temperature for generation
            max_tokens: Maximum tokens in response
            
        Returns:
            Generated response text
        """
        # Prepend context to user message
        message_with_context = f"{context}\n\nUser Question: {user_message}"
        
        return self.generate_response(
            session_id=session_id,
            user_message=message_with_context,
            system_prompt=system_prompt,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            timeout=timeout,
            max_output_tokens=max_output_tokens,
            use_chat_history=True
        )
    
    def generate_response_stream(
        self,
        session_id: str,
        user_message: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[float] = None,
        max_output_tokens: Optional[int] = 2048,
        use_chat_history: bool = True
    ) -> Iterator[str]:
        """
        Stream a response as text deltas; at stream end, save the full assistant reply in chat history.
        """
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")

        # Record the user's message immediately
        session.add_message("user", user_message)

        # Build contents with/without prior messages
        contents = self.build_contents_for_session(
            session=session,
            user_message=user_message,
            use_chat_history=use_chat_history
        )

        # Build generation config
        config_params: Dict[str, Any] = {
            "temperature": temperature if temperature is not None else self.default_temperature,
            "top_p": top_p if top_p is not None else self.top_p,
            "top_k": top_k if top_k is not None else self.top_k,
        }
        if max_output_tokens is not None:
            config_params["max_output_tokens"] = max_output_tokens
        elif self.max_output_tokens is not None:
            config_params["max_output_tokens"] = self.max_output_tokens
        if system_prompt:
            config_params["system_instruction"] = system_prompt

        generation_config = types.GenerateContentConfig(**config_params)

        # Stream from the model
        accumulated = []
        try:
            stream = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=contents,
                config=generation_config,
            )

            for chunk in stream:
                delta = getattr(chunk, "text", None)
                if not delta:
                    continue
                accumulated.append(delta)
                yield delta  # incremental text to caller/UI

            # Save final assistant message into history after stream completes
            final_text = "".join(accumulated)
            session.add_message("assistant", final_text)
            logger.info(f"Streamed response for session {session_id} with {len(accumulated)} chunks")

        except Exception as e:
            logger.error(f"Error during streaming: {str(e)}")
            raise RuntimeError(f"Failed to stream response: {str(e)}")

    def generate_response_with_context_stream(
        self,
        session_id: str,
        user_message: str,
        context: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[float] = None,
        max_output_tokens: Optional[int] = 2048,
        use_chat_history: bool = True
    ) -> Iterator[str]:
        """
        Stream a response with additional prefixed context; saves final answer to history on completion.
        """
        message_with_context = f"{context}\n\nUser Question: {user_message}"
        yield from self.generate_response_stream(
            session_id=session_id,
            user_message=message_with_context,
            system_prompt=system_prompt,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            max_output_tokens=max_output_tokens,
            use_chat_history=use_chat_history,
        )

    def get_session_history(self, session_id: str) -> Optional[List[Dict[str, str]]]:
        """Get the chat history for a session."""
        session = self.get_session(session_id)
        if session is None:
            return None
        return session.get_history()
    
    def clear_session_history(self, session_id: str) -> bool:
        """Clear the chat history for a session."""
        session = self.get_session(session_id)
        if session is None:
            return False
        session.clear_history()
        logger.info(f"Cleared history for session {session_id}")
        return True
    
    def get_session_summary(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get summary information about a session."""
        session = self.get_session(session_id)
        if session is None:
            return None
        return session.get_summary()