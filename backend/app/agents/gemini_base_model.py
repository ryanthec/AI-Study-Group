"""
Base Model Handler for Google AI Studio (Gemini API) Integration

This module provides a comprehensive base class for interacting with Google's Gemini AI models
using the new Google GenAI SDK. It includes support for:
- Single turn content generation
- Multi-turn chat conversations
- Proper error handling and logging
- Environment configuration
- Support for multiple agent roles
- Streaming responses
- Configuration management

"""

import os
import logging
import json
from typing import List, Dict, Any, Optional, Union, Iterator, AsyncIterator
from datetime import datetime
from enum import Enum

try:
    from google import genai
    from google.genai import types
    from google.genai.errors import ClientError, ServerError
except ImportError:
    raise ImportError(
        "Google GenAI SDK not found. Please install it using: pip install google-genai"
    )

from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file if present

class AgentRole(Enum):
    """Defines the different agent roles in the teaching assistant system"""
    PRIMARY_TA = "primary_ta"
    CLARIFICATION_AGENT = "clarification_agent"
    EXAMPLE_GENERATOR = "example_generator"
    QUIZ_GENERATOR = "quiz_generator"


class ScaffoldingType(Enum):
    """Different types of scaffolding support levels"""
    ORIENTING = "orienting"
    CONCEPTUAL = "conceptual"
    PROCEDURAL = "procedural"
    INSTRUMENTAL = "instrumental"


class GeminiBaseModel:
    """
    Base model class for Google AI Studio (Gemini) API integration

    This class provides a foundation for building multi-agent systems with
    proper configuration management, error handling, and logging.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-2.5-flash",
        agent_role: AgentRole = AgentRole.PRIMARY_TA,
        temperature: float = 0.7,
        top_p: float = 0.9,
        top_k: float = 40,
        max_output_tokens: Optional[int] = None,
        timeout: int = 30,
        # Vertex_AI is like the enterprise version of Gemini API, usually don't use
        use_vertex_ai: bool = False,
        project_id: Optional[str] = None,
        location: str = "asia-southeast1"
    ):
        """
        Initialize the Gemini Base Model

        Args:
            api_key: Google AI Studio API key (if None, will look for GEMINI_API_KEY or GOOGLE_API_KEY env vars)
            model: Model name to use (default: gemini-2.5-flash)
            agent_role: Role of this agent in the system
            temperature: Controls randomness (0.0-1.0)
            top_p: Controls diversity of responses (0.0-1.0)
            top_k: Limits the number of tokens considered
            max_output_tokens: Maximum number of tokens to generate
            timeout: Request timeout in seconds
            use_vertex_ai: Whether to use Vertex AI instead of Gemini API
            project_id: Google Cloud project ID (required if using Vertex AI)
            location: Google Cloud location (required if using Vertex AI)
        """

        # Set up logging
        self._setup_logging()

        # Store configuration
        self.model = model
        self.agent_role = agent_role
        self.timeout = timeout

        # Initialize generation config
        self.generation_config = types.GenerateContentConfig(
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            max_output_tokens=max_output_tokens
        )

        # Initialize the client
        self.client = self._initialize_client(
            api_key=api_key,
            use_vertex_ai=use_vertex_ai,
            project_id=project_id,
            location=location
        )

        # Initialize conversation history for multi-turn chat
        self.conversation_history: List[Dict[str, Any]] = []
        self.chat_session = None

        self.logger.info(f"Initialized GeminiBaseModel with role: {agent_role.value}")

    def _setup_logging(self):
        """Set up logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(f"GeminiAgent-{self.__class__.__name__}")

    def _initialize_client(
        self,
        api_key: Optional[str],
        use_vertex_ai: bool,
        project_id: Optional[str],
        location: str
    ) -> genai.Client:
        """
        Initialize the Google GenAI client

        Args:
            api_key: API key for authentication
            use_vertex_ai: Whether to use Vertex AI
            project_id: Google Cloud project ID
            location: Google Cloud location

        Returns:
            Configured genai.Client instance
        """
        try:
            if use_vertex_ai:
                if not project_id:
                    raise ValueError("project_id is required when using Vertex AI")

                self.logger.info("Initializing Vertex AI client")
                client = genai.Client(
                    vertexai=True,
                    project=project_id,
                    location=location
                )
            else:
                # Use Gemini Developer API
                if not api_key:
                    api_key = os.getenv('GEMINI_API_KEY')
                    if not api_key:
                        raise ValueError(
                            "API key is required. Set GEMINI_API_KEY environment variable or pass api_key parameter"
                        )

                self.logger.info("Initializing Gemini Developer API client")
                client = genai.Client(api_key=api_key)

            return client

        except Exception as e:
            self.logger.error(f"Failed to initialize client: {e}")
            raise

    def generate_content(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Generate content using the Gemini model

        Args:
            prompt: The input prompt
            system_instruction: Optional system instruction to guide the model
            **kwargs: Additional configuration parameters

        Returns:
            Generated text response

        Raises:
            ClientError: For client-side errors (400-499)
            ServerError: For server-side errors (500-599)
        """
        try:
            # Merge any additional config
            config = self.generation_config
            if kwargs:
                config_dict = config.model_dump()
                config_dict.update(kwargs)
                config = types.GenerateContentConfig(**config_dict)

            # Add system instruction if provided
            contents = prompt
            if system_instruction:
                contents = [
                    {"role": "system", "parts": [{"text": system_instruction}]},
                    {"role": "user", "parts": [{"text": prompt}]}
                ]

            self.logger.debug(f"Generating content with prompt length: {len(prompt)}")

            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )

            self.logger.debug("Content generation successful")
            return response.text

        except ClientError as e:
            self.logger.error(f"Client error during content generation: {e}")
            raise
        except ServerError as e:
            self.logger.error(f"Server error during content generation: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error during content generation: {e}")
            raise

    def start_chat_session(
        self,
        system_instruction: Optional[str] = None,
        initial_history: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """
        Start a new chat session

        Args:
            system_instruction: Optional system instruction for the chat
            initial_history: Optional initial conversation history (user/model roles only)
        """
        try:
            # Store system instruction for use in chat
            self.system_instruction = system_instruction

            # Prepare history (only user/model roles allowed)
            history = []
            if initial_history:
                for msg in initial_history:
                    if msg.get("role") in ["user", "model"]:
                        history.append({
                            "role": msg["role"],
                            "parts": msg["parts"]
                        })

            # Create chat configuration with system instruction
            config = None
            if system_instruction:
                config = types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=self.generation_config.temperature,
                    top_p=self.generation_config.top_p,
                    top_k=self.generation_config.top_k,
                    max_output_tokens=self.generation_config.max_output_tokens
                )

            # Start chat session
            if config:
                self.chat_session = self.client.chats.create(
                    model=self.model,
                    history=history,
                    config=config
                )
            else:
                self.chat_session = self.client.chats.create(
                    model=self.model,
                    history=history
                )

            self.conversation_history = history.copy()
            self.logger.info("Chat session started successfully")

        except Exception as e:
            self.logger.error(f"Failed to start chat session: {e}")
            raise

    def send_message(self, message: str) -> str:
        """
        Send a message in the current chat session

        Args:
            message: The message to send

        Returns:
            The model's response
        """
        if not self.chat_session:
            self.logger.warning("No active chat session. Starting new session.")
            self.start_chat_session()

        try:
            response = self.chat_session.send_message(message)

            # Update conversation history
            self.conversation_history.append({
                "role": "user",
                "parts": [{"text": message}],
                "timestamp": datetime.now().isoformat()
            })
            self.conversation_history.append({
                "role": "model",
                "parts": [{"text": response.text}],
                "timestamp": datetime.now().isoformat()
            })

            self.logger.debug(f"Message sent and response received. History length: {len(self.conversation_history)}")
            return response.text

        except Exception as e:
            self.logger.error(f"Failed to send message: {e}")
            raise

    def send_message_stream(self, message: str) -> Iterator[str]:
        """
        Send a message and stream the response

        Args:
            message: The message to send

        Yields:
            Chunks of the response as they arrive
        """
        if not self.chat_session:
            self.logger.warning("No active chat session. Starting new session.")
            self.start_chat_session()

        try:
            response_chunks = []
            for chunk in self.chat_session.send_message_stream(message):
                response_chunks.append(chunk.text)
                yield chunk.text

            # Update conversation history with complete response
            complete_response = ''.join(response_chunks)
            self.conversation_history.append({
                "role": "user",
                "parts": [{"text": message}],
                "timestamp": datetime.now().isoformat()
            })
            self.conversation_history.append({
                "role": "model",
                "parts": [{"text": complete_response}],
                "timestamp": datetime.now().isoformat()
            })

        except Exception as e:
            self.logger.error(f"Failed to stream message: {e}")
            raise

    def get_conversation_history(self) -> List[Dict[str, Any]]:
        """
        Get the current conversation history

        Returns:
            List of conversation messages with metadata
        """
        return self.conversation_history.copy()

    def clear_conversation_history(self) -> None:
        """Clear the conversation history and end chat session"""
        self.conversation_history.clear()
        self.chat_session = None
        self.logger.info("Conversation history cleared")

    def save_conversation(self, filename: str) -> None:
        """
        Save conversation history to a JSON file

        Args:
            filename: Name of the file to save to
        """
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump({
                    "agent_role": self.agent_role.value,
                    "model": self.model,
                    "conversation_history": self.conversation_history,
                    "saved_at": datetime.now().isoformat()
                }, f, indent=2, ensure_ascii=False)

            self.logger.info(f"Conversation saved to {filename}")

        except Exception as e:
            self.logger.error(f"Failed to save conversation: {e}")
            raise

    def load_conversation(self, filename: str) -> None:
        """
        Load conversation history from a JSON file

        Args:
            filename: Name of the file to load from
        """
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)

            self.conversation_history = data.get('conversation_history', [])

            # Restart chat session with loaded history
            if self.conversation_history:
                # Convert to format expected by chat API
                history_for_api = [
                    {
                        "role": msg["role"],
                        "parts": msg["parts"]
                    }
                    for msg in self.conversation_history
                    if msg["role"] in ["user", "model"]
                ]

                self.start_chat_session(initial_history=history_for_api)

            self.logger.info(f"Conversation loaded from {filename}")

        except Exception as e:
            self.logger.error(f"Failed to load conversation: {e}")
            raise

    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the current model configuration

        Returns:
            Dictionary with model configuration details
        """
        return {
            "model": self.model,
            "agent_role": self.agent_role.value,
            "generation_config": {
                "temperature": self.generation_config.temperature,
                "top_p": self.generation_config.top_p,
                "top_k": self.generation_config.top_k,
                "max_output_tokens": self.generation_config.max_output_tokens
            },
            "conversation_length": len(self.conversation_history),
            "has_active_chat": self.chat_session is not None
        }

    def update_generation_config(self, **kwargs) -> None:
        """
        Update the generation configuration

        Args:
            **kwargs: Configuration parameters to update
        """
        current_config = self.generation_config.model_dump()
        current_config.update(kwargs)
        self.generation_config = types.GenerateContentConfig(**current_config)
        self.logger.info(f"Generation config updated: {kwargs}")


# Example agent classes for the teaching assistant system

class PrimaryTAAgent(GeminiBaseModel):
    """Primary Teaching Assistant Agent for Socratic questioning and guidance"""

    def __init__(self, **kwargs):
        kwargs['agent_role'] = AgentRole.PRIMARY_TA
        super().__init__(**kwargs)

        self.system_instruction = """
        You are a primary teaching assistant focused on guiding students through Socratic questioning.
        Your role is to:
        1. Ask thought-provoking questions rather than giving direct answers
        2. Provide hint ladders when students are stuck
        3. Encourage metacognitive reflection
        4. Maintain appropriate challenge levels
        5. Cite course materials when providing hints

        Always encourage critical thinking and help students discover answers themselves.
        """

    def ask_socratic_question(self, student_response: str, topic: str) -> str:
        """Generate a Socratic question based on student response"""
        prompt = f"""
        Based on this student response about {topic}: "{student_response}"

        Generate a thoughtful Socratic question that will guide them toward deeper understanding.
        The question should:
        - Build on their current thinking
        - Reveal gaps in reasoning
        - Encourage exploration of the concept
        - Not give away the answer directly
        """

        return self.generate_content(prompt, self.system_instruction)

    def provide_hint_ladder(self, problem: str, student_attempt: str, level: int = 1) -> str:
        """Provide progressive hints based on scaffolding level"""
        scaffolding_levels = {
            1: "Provide an orienting hint that directs attention to the task",
            2: "Give a conceptual hint about the high-level strategy",
            3: "Offer a procedural hint about the specific steps",
            4: "Give an instrumental hint with explicit guidance"
        }

        hint_type = scaffolding_levels.get(level, scaffolding_levels[1])

        prompt = f"""
        Problem: {problem}
        Student's attempt: {student_attempt}

        {hint_type}

        Keep the hint minimal but helpful. Require the student to think further.
        """

        return self.generate_content(prompt, self.system_instruction)


class ClarificationAgent(GeminiBaseModel):
    """Clarification Agent for identifying misconceptions and missing context"""

    def __init__(self, **kwargs):
        kwargs['agent_role'] = AgentRole.CLARIFICATION_AGENT
        super().__init__(**kwargs)

        self.system_instruction = """
        You are a clarification agent whose role is to:
        1. Identify missing context in student questions
        2. Detect common misconceptions
        3. Ask for clarification when needed
        4. Help students articulate their thinking more clearly

        Be supportive and help students express their thoughts more precisely.
        """

    def identify_misconceptions(self, student_response: str, subject: str) -> Dict[str, Any]:
        """Identify potential misconceptions in student response"""
        prompt = f"""
        Analyze this student response in {subject}: "{student_response}"

        Identify any potential misconceptions and return a JSON response with:
        - "misconceptions_detected": boolean
        - "specific_misconceptions": list of identified misconceptions
        - "clarifying_questions": list of questions to address misconceptions
        - "suggested_approach": recommended teaching approach
        """

        response = self.generate_content(prompt, self.system_instruction)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"error": "Failed to parse response", "raw_response": response}


class ExampleGeneratorAgent(GeminiBaseModel):
    """Example Generator Agent for creating analogous problems and worked examples"""

    def __init__(self, **kwargs):
        kwargs['agent_role'] = AgentRole.EXAMPLE_GENERATOR
        super().__init__(**kwargs)

        self.system_instruction = """
        You are an example generator agent responsible for:
        1. Creating analogous problems at appropriate difficulty levels
        2. Generating worked examples with step-by-step solutions
        3. Providing multiple representations of concepts
        4. Creating suggested questions for students who are stuck

        Make examples clear, relevant, and educationally valuable.
        """

    def generate_similar_problem(self, original_problem: str, difficulty_level: str = "same") -> str:
        """Generate a similar problem at specified difficulty level"""
        prompt = f"""
        Original problem: {original_problem}

        Create a similar problem with {difficulty_level} difficulty level.
        Ensure it tests the same concepts but uses different context or numbers.
        Include the solution approach.
        """

        return self.generate_content(prompt, self.system_instruction)

    def generate_suggested_questions(self, context: str, num_questions: int = 4) -> List[str]:
        """Generate suggested questions for stuck students"""
        prompt = f"""
        Context: {context}

        Generate {num_questions} helpful questions that a student might ask to get unstuck.
        These should be:
        - Specific and actionable
        - Progressive in difficulty
        - Relevant to the current learning objective

        Return as a numbered list.
        """

        response = self.generate_content(prompt, self.system_instruction)
        # Parse the response to extract individual questions
        questions = [line.strip() for line in response.split('\n') if line.strip() and any(char.isdigit() for char in line[:3])]
        return questions[:num_questions]


# Utility functions for the teaching assistant system

def create_agent(agent_type: str, **config) -> GeminiBaseModel:
    """
    Factory function to create different types of agents

    Args:
        agent_type: Type of agent to create
        **config: Configuration parameters

    Returns:
        Configured agent instance
    """
    agents = {
        "primary_ta": PrimaryTAAgent,
        "clarification": ClarificationAgent,
        "example_generator": ExampleGeneratorAgent,
        "base": GeminiBaseModel
    }

    agent_class = agents.get(agent_type.lower())
    if not agent_class:
        raise ValueError(f"Unknown agent type: {agent_type}")

    return agent_class(**config)


def setup_multi_agent_system(api_key: Optional[str] = None, **config) -> Dict[str, GeminiBaseModel]:
    """
    Set up a complete multi-agent teaching assistant system

    Args:
        api_key: API key for authentication
        **config: Additional configuration parameters

    Returns:
        Dictionary of initialized agents
    """
    base_config = {"api_key": api_key, **config}

    return {
        "primary_ta": PrimaryTAAgent(**base_config),
        "clarification": ClarificationAgent(**base_config),
        "example_generator": ExampleGeneratorAgent(**base_config)
    }


if __name__ == "__main__":
    # Example usage
    import sys

    # Check if API key is available
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("Error: Please set GEMINI_API_KEY environment variable")
        sys.exit(1)

    # Test basic functionality
    try:
        # Create a primary TA agent
        ta_agent = PrimaryTAAgent(api_key=api_key)

        # Test content generation
        response = ta_agent.generate_content("What is the purpose of education?")
        print("Basic generation test successful!")
        print(f"Response: {response[:100]}...")

        # Test chat functionality
        ta_agent.start_chat_session("You are helping a student learn about mathematics.")
        chat_response = ta_agent.send_message("I'm having trouble with algebra. Can you help?")
        print("\nChat test successful!")
        print(f"Chat response: {chat_response[:100]}...")

        print("\nAll tests passed! The base model is ready to use.")

    except Exception as e:
        print(f"Error during testing: {e}")
        print("Please check your API key and internet connection.")
