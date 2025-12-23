from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime, timezone

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.quiz import Quiz, QuizScope, QuizAttempt
from ...models.study_group import StudyGroup
from ...models.study_group_membership import StudyGroupMembership
from ...agents.base_llm_model import BaseLLMModel
from ...agents.quiz_agent import QuizGeneratorAgent
from ...schemas.quiz import QuizCreateRequest, QuizResponse, QuizAttemptRequest, QuizAttemptResponse, QuizAttemptSummary


router = APIRouter(prefix="/quizzes", tags=["quizzes"])
llm_model = BaseLLMModel()
quiz_agent = QuizGeneratorAgent(llm_model)


# --- Endpoints ---

@router.post("/groups/{group_id}/create", response_model=QuizResponse)
async def create_quiz(
    group_id: int,
    request: QuizCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify group exists
    group = db.query(StudyGroup).filter(StudyGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Study group not found")
    
    # Verify group membership
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="You must be a member of this study group to create quizzes")
    
    # Generate content
    # Note: For production, use BackgroundTasks for long generation times
    try:
        session_id = f"quiz_gen_{group_id}_{current_user.id}"
        quiz_content = await quiz_agent.generate_quiz(
            session_id=session_id,
            document_ids=request.document_ids,
            topic_prompt=request.topic_prompt,
            num_questions=request.num_questions,
            db=db
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Save to DB
    new_quiz = Quiz(
        title=request.title,
        description=request.description,
        study_group_id=group_id,
        creator_id=current_user.id,
        questions=quiz_content.get("questions", []),
        scope=QuizScope(request.scope),
        num_questions=len(quiz_content.get("questions", [])),
    )
    
    db.add(new_quiz)
    db.commit()
    db.refresh(new_quiz)
    
    return QuizResponse(
        id=new_quiz.id,
        title=new_quiz.title,
        description=new_quiz.description,
        num_questions=new_quiz.num_questions,
        scope=new_quiz.scope.value,
        created_at=new_quiz.created_at.isoformat(),
        creator_name=f"{current_user.first_name} {current_user.last_name}",
        questions=new_quiz.questions
    )

@router.get("/groups/{group_id}/list", response_model=List[QuizResponse])
def list_quizzes(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch relevant quizzes
    quizzes = db.query(Quiz).filter(
        Quiz.study_group_id == group_id,
        (Quiz.scope == QuizScope.GROUP) | 
        ((Quiz.scope == QuizScope.PERSONAL) & (Quiz.creator_id == current_user.id))
    ).order_by(Quiz.created_at.desc()).all()
    
    results = []
    for quiz in quizzes:
        # 2. Fetch the LATEST attempt for this specific quiz and user
        # We order by completed_at desc and take the first one
        latest_attempt = db.query(QuizAttempt).filter(
            QuizAttempt.quiz_id == quiz.id,
            QuizAttempt.user_id == current_user.id
        ).order_by(QuizAttempt.completed_at.desc()).first()
        
        attempt_summary = None
        if latest_attempt:
            attempt_summary = QuizAttemptSummary(
                score=latest_attempt.score,
                total_questions=latest_attempt.total_questions,
                passed=(latest_attempt.score / latest_attempt.total_questions) >= 0.5,
                completed_at=latest_attempt.completed_at.isoformat()
            )

        results.append(QuizResponse(
            id=quiz.id,
            title=quiz.title,
            description=quiz.description,
            num_questions=quiz.num_questions,
            scope=quiz.scope.value,
            created_at=quiz.created_at.isoformat(),
            creator_name=f"{quiz.creator.first_name} {quiz.creator.last_name}",
            latest_attempt=attempt_summary,
            questions=quiz.questions
        ))
    
    return results


@router.delete("/groups/{group_id}/delete/{quiz_id}")
def delete_quiz(
    group_id: int,
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch the quiz
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.study_group_id == group_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Check user's membership and role
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="You must be a member of this study group")
    
    # Check permissions based on quiz scope
    is_creator = quiz.creator_id == current_user.id
    is_admin = membership.role.value == "admin"
    
    if quiz.scope == QuizScope.PERSONAL:
        # Personal quizzes can only be deleted by the creator
        if not is_creator:
            raise HTTPException(status_code=403, detail="Only the creator can delete a personal quiz")
    else:  # QuizScope.GROUP
        # Group quizzes can be deleted by the creator or an admin
        if not (is_creator or is_admin):
            raise HTTPException(status_code=403, detail="Only the creator or a group admin can delete this quiz")
    
    db.delete(quiz)
    db.commit()
    return {"message": "Quiz deleted successfully"}


@router.post("/groups/{group_id}/submit_attempt/{quiz_id}", response_model=QuizAttemptResponse)
def submit_quiz_attempt(
    group_id: int,
    quiz_id: int,
    attempt_data: QuizAttemptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.study_group_id == group_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    correct_count = 0
    questions = quiz.questions
    
    # Calculate score
    for idx, question in enumerate(questions):
        user_answer = attempt_data.answers.get(idx)
        # Convert keys to strings for JSON compatibility if needed
        correct_answer = question.get("correct_answer")
        if str(user_answer).strip() == str(correct_answer).strip():
            correct_count += 1
            
    # Save Attempt WITH answers
    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=current_user.id,
        score=correct_count,
        total_questions=len(questions),
        answers=attempt_data.answers,  # <--- Saving here
        completed_at=datetime.now(timezone.utc)
    )
    db.add(attempt)
    
    current_user.quizzes_completed += 1
    db.add(current_user)
    
    db.commit()
    db.refresh(attempt)
    
    return QuizAttemptResponse(
        attempt_id=attempt.id,
        score=correct_count,
        total_questions=len(questions),
        percentage=(correct_count / len(questions)) * 100,
        passed=(correct_count / len(questions)) >= 0.5,
        completed_at=attempt.completed_at.isoformat(),
        answers=attempt.answers
    )


# Endpoint to Get Latest Attempt
@router.get("/groups/{group_id}/latest_attempt/{quiz_id}", response_model=QuizAttemptResponse)
def get_latest_quiz_attempt(
    group_id: int,
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch the full details of the user's latest attempt for this quiz"""
    attempt = db.query(QuizAttempt).filter(
        QuizAttempt.quiz_id == quiz_id,
        QuizAttempt.user_id == current_user.id
    ).order_by(QuizAttempt.completed_at.desc()).first()
    
    if not attempt:
        raise HTTPException(status_code=404, detail="No attempts found for this quiz")
        
    return QuizAttemptResponse(
        attempt_id=attempt.id,
        score=attempt.score,
        total_questions=attempt.total_questions,
        percentage=(attempt.score / attempt.total_questions) * 100,
        passed=(attempt.score / attempt.total_questions) >= 0.5,
        completed_at=attempt.completed_at.isoformat(),
        answers=attempt.answers # Make sure to cast keys to int if needed in frontend
    )