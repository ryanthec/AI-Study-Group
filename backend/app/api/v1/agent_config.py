# app/api/v1/agent_config.py
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.study_group_membership import StudyGroupMembership, MemberRole
from ...agents.teaching_agent import RAGMode, QuestionDifficulty

# Import the shared teaching_agent and helper from chat.py
from .chat import teaching_agent, get_user_from_token

router = APIRouter(prefix="/agent-config", tags=["agent-config"])


# Helper to extract token from Authorization header
def get_token_from_header(authorization: str = Header(None)) -> str | None:
    """Extract Bearer token from Authorization header."""
    print(f"[Agent Config] Raw Authorization header: {authorization}")
    
    if not authorization:
        print("[Agent Config] No authorization header received!")
        return None
    
    # Authorization header format: "Bearer <token>"
    parts = authorization.split()
    print(f"[Agent Config] Split parts: {len(parts)} parts")
    
    if len(parts) == 2 and parts[0].lower() == "bearer":
        token = parts[1]
        print(f"[Agent Config] Extracted token: {token[:20]}... (length: {len(token)})")
        print(f"[Agent Config] Token segments: {len(token.split('.'))}")
        return token
    
    print(f"[Agent Config] Invalid authorization format: {parts}")
    return None


@router.get("/{group_id}")
async def get_agent_config(
    group_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
):
    """
    Get current teaching agent configuration for a group.

    This returns the global agent config (all groups share same agent).
    """
    token = get_token_from_header(authorization)
    user = get_user_from_token(token, db) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    membership = (
        db.query(StudyGroupMembership)
        .filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user.id,
            StudyGroupMembership.is_active == True,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    status = teaching_agent.get_status()

    return {
        "rag_mode": status["rag_mode"],
        "rag_enabled": status["rag_enabled"],
        "socratic_prompting": status["socratic_prompting"],
        "socratic_limits": status["socratic_limits"],
        "temperature": status["temperature"],
        "max_tokens": status["max_tokens"],
    }


@router.post("/{group_id}/rag-mode")
async def update_rag_mode(
    group_id: int,
    rag_mode: str,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
):
    """Update RAG mode. Admin only."""
    token = get_token_from_header(authorization)
    user = get_user_from_token(token, db) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    membership = (
        db.query(StudyGroupMembership)
        .filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user.id,
            StudyGroupMembership.role == MemberRole.ADMIN,
            StudyGroupMembership.is_active == True,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=403, detail="Only admins can change agent settings"
        )

    valid_modes = ["disabled", "documents_only", "conversations_only", "both"]
    if rag_mode not in valid_modes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid RAG mode. Must be one of: {valid_modes}",
        )

    try:
        teaching_agent.set_rag_mode(RAGMode[rag_mode.upper()])
        return {
            "status": "success",
            "message": f"RAG mode changed to {rag_mode}",
            "rag_mode": rag_mode,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{group_id}/socratic-mode")
async def update_socratic_mode(
    group_id: int,
    enabled: bool,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
):
    """Enable/disable Socratic prompting. Admin only."""
    token = get_token_from_header(authorization)
    user = get_user_from_token(token, db) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    membership = (
        db.query(StudyGroupMembership)
        .filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user.id,
            StudyGroupMembership.role == MemberRole.ADMIN,
            StudyGroupMembership.is_active == True,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=403, detail="Only admins can change agent settings"
        )

    try:
        teaching_agent.config.use_socratic_prompting = enabled
        return {
            "status": "success",
            "message": f"Socratic prompting {'enabled' if enabled else 'disabled'}",
            "socratic_prompting": enabled,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{group_id}/socratic-limits")
async def update_socratic_limits(
    group_id: int,
    factual: int | None = None,
    conceptual: int | None = None,
    applied: int | None = None,
    complex: int | None = None,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
):
    """Update Socratic limits. Admin only."""
    token = get_token_from_header(authorization)
    user = get_user_from_token(token, db) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    membership = (
        db.query(StudyGroupMembership)
        .filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user.id,
            StudyGroupMembership.role == MemberRole.ADMIN,
            StudyGroupMembership.is_active == True,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=403, detail="Only admins can change agent settings"
        )

    try:
        if factual is not None:
            teaching_agent.set_socratic_prompt_limit(
                QuestionDifficulty.FACTUAL, factual
            )
        if conceptual is not None:
            teaching_agent.set_socratic_prompt_limit(
                QuestionDifficulty.CONCEPTUAL, conceptual
            )
        if applied is not None:
            teaching_agent.set_socratic_prompt_limit(
                QuestionDifficulty.APPLIED, applied
            )
        if complex is not None:
            teaching_agent.set_socratic_prompt_limit(
                QuestionDifficulty.COMPLEX, complex
            )

        status = teaching_agent.get_status()

        return {
            "status": "success",
            "message": "Socratic limits updated",
            "socratic_limits": status["socratic_limits"],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{group_id}/temperature")
async def update_temperature(
    group_id: int,
    temperature: float,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
):
    """Update temperature. Admin only."""
    token = get_token_from_header(authorization)
    user = get_user_from_token(token, db) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    membership = (
        db.query(StudyGroupMembership)
        .filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user.id,
            StudyGroupMembership.role == MemberRole.ADMIN,
            StudyGroupMembership.is_active == True,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=403, detail="Only admins can change agent settings"
        )

    try:
        teaching_agent.set_temperature(temperature)
        return {
            "status": "success",
            "message": f"Temperature updated to {temperature}",
            "temperature": temperature,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))