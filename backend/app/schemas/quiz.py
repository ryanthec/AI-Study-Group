from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union


class QuizCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    document_ids: List[int]
    topic_prompt: str
    num_questions: int = 10
    scope: str = "group" # 'group' or 'personal'

class QuizAttemptSummary(BaseModel):
    score: int
    total_questions: int
    passed: bool
    completed_at: str


class QuizAttemptRequest(BaseModel):
    answers: Dict[int, str] 

class QuizAttemptResponse(BaseModel):
    attempt_id: int
    score: int
    total_questions: int
    percentage: float
    passed: bool
    completed_at: str
    answers: Dict[int, str]


# Add a helper model for clarity
class QuestionSchema(BaseModel):
    question: str
    options: List[str]
    correct_answer: Union[str, int]
    explanation: Optional[str] = None

class QuizResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    num_questions: int
    scope: str
    created_at: str
    creator_name: str
    latest_attempt: Optional[QuizAttemptSummary] = None
    questions: List[QuestionSchema] 
    
    class Config:
        from_attributes = True