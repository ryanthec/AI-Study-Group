import logging
from typing import List, Dict, Any
from .base_llm_model import BaseLLMModel

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM_PROMPT = """You are a helpful study assistant. 
A student has returned to the chat after being away. 
Summarise the missed conversation for them.

Focus on:
1. Key topics discussed.
2. Specific questions asked to the Teaching AI.
3. Important decisions or conclusions made by the group.

Format the output as a concise bulleted list or a short paragraph. 
Do NOT list every single message. Synthesize the information.
"""

class SummarisingAgent:
    def __init__(self, base_llm: BaseLLMModel):
        self.base_llm = base_llm

    async def summarise_chat(self, messages: List[Dict[str, Any]]) -> str:
        if not messages:
            return "No messages to summarise."

        # Format messages for the LLM
        # e.g. "User1: Hello", "AI: Hi there"
        conversation_text = ""
        for msg in messages:
            sender = msg.get("username", "Unknown")
            content = msg.get("content", "")
            conversation_text += f"{sender}: {content}\n"

        prompt = f"""
        Here is the conversation log:
        
        {conversation_text}
        
        Please provide a summary for the returning student.
        """

        try:
            response = await self.base_llm.generate_stateless_response(
                prompt=prompt,
                system_prompt=SUMMARY_SYSTEM_PROMPT,
                max_output_tokens=1000,
                temperature=0.3
            )
            return response
        except Exception as e:
            logger.error(f"Error summarising chat: {e}")
            return "Failed to generate summary."