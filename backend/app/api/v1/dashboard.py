
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.study_group_membership import StudyGroupMembership
from ...models.study_group import StudyGroup, StudyGroupStatus
from ...services.progress_service import ProgressService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_groups = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.is_active == True
    ).count()

    groups_created = db.query(StudyGroup).filter(
        StudyGroup.creator_id == current_user.id,
        StudyGroup.status == StudyGroupStatus.ACTIVE
    ).count()

    quizzes_completed = current_user.quizzes_completed

    return {
        "total_groups": total_groups,
        "groups_created": groups_created,
        "quizzes_completed": quizzes_completed,
    }

# Method not used for now but can be used in the future (When I want to check how many modules users have completed)
@router.post("/sessions/increment")
async def increment_sessions_completed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = ProgressService.increment_sessions(db, current_user.id, 1)
    return {"sessions_completed": row.sessions_completed}