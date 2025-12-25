import logging
import json
import mimetypes
from typing import List, Optional
from .base_llm_model import BaseLLMModel
from sqlalchemy.orm import Session
from ..models.document_embedding import Document 

logger = logging.getLogger(__name__)

# --- UPDATED PROMPT ---
QUIZ_SYSTEM_PROMPT = """You are an expert educational content creator. 
Your task is to generate high-quality multiple-choice quizzes based on the attached document(s).

OUTPUT FORMAT:
Return a valid JSON object with a key "questions" containing a list of objects.
Each object must have:
- "question": The question text.
- "options": An array of exactly 4 distinct string answers.
- "correct_answer": The exact string value of the correct option (must match one of the strings in the options array exactly).
- "explanation": A brief explanation of why the answer is correct.

Do not include markdown formatting (like ```json) in the response, just the raw JSON string.

### JSON EXAMPLE:
{
  "questions": [
    {
      "question": "What is the powerhouse of the cell?",
      "options": [
        "A. The Nucleus",
        "B. The Mitochondria",
        "C. The Ribosome",
        "D. The Chloroplast"
      ],
      "correct_answer": "B. The Mitochondria",
      "explanation": "Mitochondria are known as the powerhouse of the cell because they generate most of the cell's supply of adenosine triphosphate (ATP)."
    }
  ]
}
"""

class QuizGeneratorAgent:
    def __init__(self, base_llm: BaseLLMModel):
        self.base_llm = base_llm

    def _get_mime_type(self, filename: str) -> str:
        mime, _ = mimetypes.guess_type(filename)
        if mime:
            return mime
        # Fallback
        if filename.endswith(".pdf"): return "application/pdf"
        if filename.endswith(".docx"): return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return "text/plain"

    async def generate_quiz(
        self, 
        session_id: str, 
        document_ids: List[int], 
        topic_prompt: str, 
        num_questions: int, 
        db: Session
    ) -> dict:
        
        uploaded_files = []
        doc_names = []

        # 1. Fetch Documents and Upload
        if document_ids:
            docs = db.query(Document).filter(Document.id.in_(document_ids)).all()
            
            for doc in docs:
                if doc.file_data:
                    mime_type = self._get_mime_type(doc.filename)
                    try:
                        print(f"DEBUG: Uploading {doc.filename} to GenAI...")
                        file_ref = self.base_llm.upload_file_from_bytes(
                            file_bytes=doc.file_data,
                            mime_type=mime_type,
                            display_name=doc.filename
                        )
                        uploaded_files.append(file_ref)
                        doc_names.append(doc.filename)
                    except Exception as e:
                        logger.error(f"Skipping document {doc.filename}: {e}")

        # 2. Construct Prompt
        doc_list_str = ", ".join(doc_names) if doc_names else "provided context"
        
        user_message = f"""
        Generate a quiz with {num_questions} multiple choice questions.
        
        User Topic/Focus: {topic_prompt}
        
        Context: Use the attached file(s) ({doc_list_str}) as the source material.
        Ensure questions vary in difficulty (Factual, Conceptual, Applied).
        """

        print("DEBUG: Calling QUIZ AGENT (Stateless)")
        
        # 3. Call LLM (Using Stateless Method)
        # Note: We pass max_output_tokens=4000 to ensure we get the full JSON
        response_text = await self.base_llm.generate_stateless_response(
            prompt=user_message,
            system_prompt=QUIZ_SYSTEM_PROMPT,
            temperature=0.4, 
            max_output_tokens=4000,
            attachments=uploaded_files 
        )

        if not response_text:
            raise ValueError("Empty response received from AI Model")

        # 4. Parse JSON
        try:
            cleaned_text = response_text.replace("```json", "").replace("```", "").strip()
            quiz_data = json.loads(cleaned_text)
            return quiz_data
        except json.JSONDecodeError:
            logger.error(f"Failed to parse quiz JSON: {response_text}")
            raise ValueError("Failed to generate valid quiz format. Please try again.")