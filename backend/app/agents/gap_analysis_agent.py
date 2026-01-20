import logging
import json
import mimetypes
from typing import List, Dict, Any
from .base_llm_model import BaseLLMModel
from sqlalchemy.orm import Session
from ..models.document_embedding import Document
from ..models.quiz import Quiz, QuizAttempt

logger = logging.getLogger(__name__)

GAP_ANALYSIS_SYSTEM_PROMPT = """You are an expert academic tutor.
Analyze the student's quiz performance and generate a comprehensive "Knowledge Gap Report".

INPUT DATA:
- Quiz Questions & Correct Answers
- Student's Incorrect Answers
- Source Documents (if any)

OUTPUT FORMAT:
Return a strictly formatted Markdown report. Do NOT use code blocks for the whole response. Use the following structure:

# 📊 Performance Analysis

## 1. Executive Summary
[Provide a 3-4 sentence overview of their performance, highlighting general strengths and the specific area where they struggled.]

## 2. 🧠 Detailed Knowledge Gaps
[For each major concept missed, create a subsection]

### • [Concept Name]
**The Misconception:** [Explain what the student likely thought based on their wrong answer]
**The Correct Concept:** [Deep dive into the correct logic, referencing source documents if available]
**Example:** [Provide a concrete example to illustrate the rule]

## 3. 📝 Targeted Study Notes
[Bulleted list of key facts, definitions, or formulas they need to memorize to fix these errors.]

## 4. 🎯 Recommended Focus
[Specific advice on what to read or practice next.]

TONE: Professional, encouraging, and detailed.
"""

class GapAnalysisAgent:
    def __init__(self, base_llm: BaseLLMModel):
        self.base_llm = base_llm

    def _get_mime_type(self, filename: str) -> str:
        mime, _ = mimetypes.guess_type(filename)
        if mime: return mime
        if filename.endswith(".pdf"): return "application/pdf"
        if filename.endswith(".docx"): return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return "text/plain"

    async def generate_analysis(
        self,
        quiz: Quiz,
        attempt: QuizAttempt,
        db: Session
    ) -> str:
        
        # 1. Identify Wrong Answers
        wrong_answers = []
        questions = quiz.questions
        user_answers = attempt.answers
        
        for idx, q in enumerate(questions):
            u_ans = user_answers.get(str(idx)) or user_answers.get(idx)
            if str(u_ans) != str(q['correct_answer']):
                wrong_answers.append({
                    "question": q['question'],
                    "user_answer": u_ans,
                    "correct_answer": q['correct_answer'],
                    "explanation": q.get('explanation', '')
                })

        # If they got everything right, give a different prompt
        if not wrong_answers:
            return "# Perfect Score! 🎉\n\nYou demonstrated excellent mastery of this topic. No knowledge gaps were detected based on this quiz. Keep up the great work!"

        # 2. Fetch Source Documents (if any)
        uploaded_files = []
        doc_names = []
        
        # Note: This relies on the new `document_ids` column in Quiz model
        if quiz.document_ids:
            docs = db.query(Document).filter(Document.id.in_(quiz.document_ids)).all()
            for doc in docs:
                if doc.file_data:
                    mime = self._get_mime_type(doc.filename)
                    try:
                        file_ref = self.base_llm.upload_file_from_bytes(
                            doc.file_data, mime, doc.filename
                        )
                        uploaded_files.append(file_ref)
                        doc_names.append(doc.filename)
                    except Exception as e:
                        logger.error(f"Error uploading doc for analysis: {e}")

        # 3. Construct the Prompt
        mistakes_text = json.dumps(wrong_answers, indent=2)
        doc_context_str = ", ".join(doc_names) if doc_names else "general knowledge (no docs attached)"

        prompt = f"""
        Please generate a Gap Analysis Report for this student.
        
        **Quiz Context**:
        - Topic: {quiz.title}
        - Source Material: {doc_context_str}
        - Score: {attempt.score}/{attempt.total_questions}
        
        **Mistakes Made**:
        {mistakes_text}
        
        Generate the study notes and analysis now.
        """

        # 4. Call LLM
        response = await self.base_llm.generate_stateless_response(
            prompt=prompt,
            system_prompt=GAP_ANALYSIS_SYSTEM_PROMPT,
            max_output_tokens=3000,
            temperature=0.5,
            attachments=uploaded_files
        )

        return response