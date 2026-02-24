import os
import io
from typing import Optional, List, Dict, Any, Iterator, AsyncIterator
from abc import ABC, abstractmethod
from datetime import datetime
from dataclasses import dataclass, field
import json
import logging

from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError

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

        self.fallback_chain = [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite" # Fallback to lite version
        ]
        
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
        if self.sessions.pop(session_id, None) is not None:
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
    
    def add_message_to_history(self, session_id: str, role: str, content: str) -> bool:
        """
        Manually add a message to the session history.
        Useful for injecting system context, quiz results, or specialized event logs.
        
        Args:
            session_id: The session identifier
            role: The role (e.g., 'system', 'user', 'assistant')
            content: The message content
            
        Returns:
            bool: True if session exists and message added, False otherwise.
        """
        session = self.get_session(session_id)
        if session:
            session.add_message(role, content)
            return True
        logger.warning(f"Attempted to add message to non-existent session {session_id}")
        return False
    
    # ========================
    # Core LLM Functionality
    # ========================

    # Helper to upload files from as an attachment in model API calls
    def upload_file_from_bytes(self, file_bytes: bytes, mime_type: str, display_name: str = "attachment") -> types.File:
        try:
            file_io = io.BytesIO(file_bytes)
            file_upload = self.client.files.upload(
                file=file_io,
                config=types.UploadFileConfig(display_name=display_name, mime_type=mime_type)
            )
            logger.info(f"Uploaded file {display_name} ({mime_type}) with URI {file_upload.uri}")
            return file_upload
        except Exception as e:
            logger.error(f"Failed to upload file bytes: {str(e)}")
            raise RuntimeError(f"File upload failed: {str(e)}")
        
    # Helper to build contents from session history
    def build_contents_for_session(
        self,
        session: ChatSession,
        user_message: str,
        use_chat_history: bool,
        attachments: Optional[List[types.File]] = None
        ) -> list[types.Content]:
        contents: list[types.Content] = []
        
        # 1. Add Chat History (if enabled)
        if use_chat_history and len(session.chat_history) > 0:
            for msg in session.chat_history:
                role = msg["role"]
                text = msg["content"]
                # Map 'assistant' to 'model' for the API
                api_role = "model" if role == "assistant" else "user"
                
                # History usually just has text, but you could expand this if you save file references in history
                contents.append(types.Content(role=api_role, parts=[types.Part.from_text(text=text)]))

        # 2. Build the Current Message Parts
        current_message_parts = []

        # A. Add Attachments First (if any)
        if attachments:
            for file_ref in attachments:
                current_message_parts.append(
                    types.Part.from_uri(
                        file_uri=file_ref.uri,
                        mime_type=file_ref.mime_type
                    )
                )

        # B. Add User Text
        current_message_parts.append(types.Part.from_text(text=user_message))

        # 3. Append to Contents
        contents.append(
            types.Content(
                role="user",
                parts=current_message_parts
            )
        )
        
        return contents
    
    async def generate_response(
        self,
        session_id: str,
        user_message: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[float] = None,
        max_output_tokens: Optional[int] = 2048,
        timeout: Optional[int] = None,
        use_chat_history: bool = True,
        attachments: Optional[List[types.File]] = None
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
        

        # Build contents for API call
        contents = self.build_contents_for_session(
            session=session,
            user_message=user_message,
            use_chat_history=use_chat_history,
            attachments=attachments,
        )
        
        # Prepare generation config
        config_params: Dict[str, Any] = {
            "temperature": temperature if temperature is not None else self.default_temperature,
            "top_p": top_p if top_p is not None else self.top_p,
            "top_k": top_k if top_k is not None else self.top_k,
            "thinking_config": types.ThinkingConfig(thinking_budget=0),
        }
        
        if max_output_tokens is not None:
            config_params["max_output_tokens"] = max_output_tokens
        elif self.max_output_tokens is not None:
            config_params["max_output_tokens"] = self.max_output_tokens
        
        if system_prompt:
            config_params["system_instruction"] = system_prompt
        
        generation_config = types.GenerateContentConfig(**config_params)

        # Cascade through fallback models
        last_exception = None
    
        for model in self.fallback_chain:
            try:
                logger.info(f"Attempting generation with model: {model}")
                
                response = await self.client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=generation_config, 
                )
                
                response_text = response.text if response.text else ""
                
                # Success! Save to history and return
                session.add_message("assistant", response_text)
                return response_text

            except (ClientError, ServerError) as e:

                if e.code in [429, 503]:
                    logger.warning(f"Rate limit/Error hit on {model} (Status: {e.code}). Falling back...")
                    last_exception = e
                    continue # Try next model
                
                # Treat other 5xx errors as retriable if you want, or raise them. 
                # For safety, we usually raise 4xx errors (like 400 Invalid Argument) immediately.
                if isinstance(e, ClientError):
                    logger.error(f"Non-retriable ClientError on {model}: {e}")
                    raise e
                
                # If it's a ServerError other than 503, we might want to continue or raise.
                # Currently your logic raises non-503s here, which is fine:
                logger.error(f"Non-retriable ServerError on {model}: {e}")
                raise e

            except Exception as e:
                logger.error(f"Unexpected error on {model}: {e}")
                last_exception = e
                continue

        # If we exit the loop, all models failed
        error_msg = f"All models exhausted. Last error: {str(last_exception)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)

    
    async def generate_response_with_context(
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
        attachments: Optional[List[types.File]] = None,
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
        
        return await self.generate_response(
            session_id=session_id,
            user_message=message_with_context,
            system_prompt=system_prompt,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            timeout=timeout,
            max_output_tokens=max_output_tokens,
            use_chat_history=True,
            attachments=attachments,
        )
    
    async def generate_response_stream(
        self,
        session_id: str,
        user_message: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[float] = None,
        max_output_tokens: Optional[int] = 2048,
        use_chat_history: bool = True,
        attachments: Optional[List[types.File]] = None
        
    ) -> AsyncIterator[str]:
        """
        Stream a response as text deltas with cascading fallback support.
        """
        session = self.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")

        # 1. Record User Message (Do this once, regardless of how many retries)
        session.add_message("user", user_message)

        # 2. Build Contents (Shared across all attempts)
        contents = self.build_contents_for_session(
            session=session,
            user_message=user_message,
            use_chat_history=use_chat_history,
            attachments=attachments,
        )

        # 3. Prepare Base Config
        config_params: Dict[str, Any] = {
            "temperature": temperature if temperature is not None else self.default_temperature,
            "top_p": top_p if top_p is not None else self.top_p,
            "top_k": top_k if top_k is not None else self.top_k,
            # Note: Ensure 'thinking_config' is supported by Flash/Lite or handle potential warnings
            "thinking_config": types.ThinkingConfig(thinking_budget=0),
        }
        
        if max_output_tokens is not None:
            config_params["max_output_tokens"] = max_output_tokens
        elif self.max_output_tokens is not None:
            config_params["max_output_tokens"] = self.max_output_tokens
            
        if system_prompt:
            config_params["system_instruction"] = system_prompt

        generation_config = types.GenerateContentConfig(**config_params)

        # === CASCADE LOOP ===
        accumulated = []
        last_exception = None
        
        # We need to know if we successfully started streaming to avoid duplicates
        stream_completed_successfully = False

        for model in self.fallback_chain:
            has_yielded_content = False # Track if this specific model output anything
            
            try:
                logger.info(f"Attempting stream with model: {model}")
                
                # Get the stream iterator
                stream = await self.client.aio.models.generate_content_stream(
                    model=model,
                    contents=contents,
                    config=generation_config,
                )

                async for chunk in stream:
                    delta = getattr(chunk, "text", None)
                    if not delta:
                        continue
                    
                    # If we get here, the model is working.
                    has_yielded_content = True
                    accumulated.append(delta)
                    yield delta
                
                # If we finish the loop, we are done
                stream_completed_successfully = True
                break

            except (ClientError, ServerError) as e:
                # 429 (Too Many Requests) or 503 (Service Unavailable)
                if e.code in [429, 503]:
                    if has_yielded_content:
                        # CRITICAL: If we already sent text to the frontend, we cannot 
                        # cleanly switch to a new model (it would restart the sentence).
                        # We must raise the error.
                        logger.error(f"Rate limit hit mid-stream on {model}. Cannot fallback.")
                        raise e
                    
                    # Otherwise, clean retry
                    logger.warning(f"Rate limit hit on {model} (start of stream). Falling back...")
                    last_exception = e
                    continue
                else:
                    # Non-retriable error (e.g., Invalid Argument)
                    logger.error(f"Non-retriable error on {model}: {e}")
                    raise e
                    
            except Exception as e:
                if has_yielded_content:
                    logger.error(f"Error mid-stream on {model}: {e}")
                    raise e
                    
                logger.error(f"Unexpected error on {model}: {e}")
                last_exception = e
                continue

        # 4. Finalize
        if stream_completed_successfully:
            final_text = "".join(accumulated)
            session.add_message("assistant", final_text)
            logger.info(f"Streamed response for session {session_id} with {len(accumulated)} chunks")
        else:
            # If we fall through the loop without success
            error_msg = f"All models exhausted for streaming. Last error: {str(last_exception)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

    async def generate_response_with_context_stream(
        self,
        session_id: str,
        user_message: str,
        context: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[float] = None,
        max_output_tokens: Optional[int] = 2048,
        use_chat_history: bool = True,
        attachments: Optional[List[types.File]] = None,
    ) -> AsyncIterator[str]:
        """
        Stream a response with additional prefixed context; saves final answer to history on completion.
        """
        message_with_context = f"{context}\n\nUser Question: {user_message}"
        async for chunk in self.generate_response_stream(
            session_id=session_id,
            user_message=message_with_context,
            system_prompt=system_prompt,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            max_output_tokens=max_output_tokens,
            use_chat_history=use_chat_history,
            attachments=attachments,
        ):
            yield chunk



    # Stateless generation for one-off tasks such as question classification or summarization
    # Does not affect session history
    async def generate_stateless_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_output_tokens: int = 100,
        temperature: float = 0.0,
        attachments: Optional[List[types.File]] = None,
        response_mime_type: Optional[str] = None,
    ) -> str:
        """
        Generate a one-off response without session history.
        Useful for internal tasks like classification or summarization.
        Includes cascading fallback support (Flash -> Lite).
        """
        
        # 1. Build Content Parts (Files + Text)
        message_parts = []
        
        # Add Attachments first if they exist
        if attachments:
            for file_ref in attachments:
                message_parts.append(
                    types.Part.from_uri(
                        file_uri=file_ref.uri,
                        mime_type=file_ref.mime_type
                    )
                )
        
        # Add the text prompt
        message_parts.append(types.Part.from_text(text=prompt))
        
        contents = [types.Content(role="user", parts=message_parts)]

        # 2. Prepare Config
        config_params = {
            "temperature": temperature,
            "max_output_tokens": max_output_tokens,
            "top_p": 0.95,
            "top_k": 40,
            # "thinking_config": types.ThinkingConfig(thinking_budget=0), 
        }
        
        if system_prompt:
            config_params["system_instruction"] = system_prompt

        if response_mime_type:
            config_params["response_mime_type"] = response_mime_type

        generation_config = types.GenerateContentConfig(**config_params)
        
        # 3. Cascade Loop
        last_exception = None
        
        for model in self.fallback_chain:
            try:
                logger.info(f"Attempting stateless generation with model: {model}")
                
                # Call Model (Stateless)
                response = await self.client.aio.models.generate_content(
                    model=model,
                    contents=contents,
                    config=generation_config,
                )
                
                return response.text if response.text else ""
            
            except (ClientError, ServerError) as e:
                # Check for Rate Limit (429) or Service Unavailable (503)
                if e.code in [429, 503]:
                    logger.warning(f"Stateless rate limit hit on {model} (Status: {e.code}). Falling back...")
                    last_exception = e
                    continue # Try next model
                else:
                    # Non-retriable error
                    logger.error(f"Stateless non-retriable error on {model}: {e}")
                    raise e
                    
            except Exception as e:
                logger.error(f"Stateless unexpected error on {model}: {e}")
                last_exception = e
                continue
        

        # If we fall through the loop without success
        error_msg = f"All models exhausted for stateless generation. Last error: {str(last_exception)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)