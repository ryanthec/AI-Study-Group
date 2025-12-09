from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ...models.study_group_membership import MemberRole
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...schemas.study_group import (
    CreateStudyGroupRequest, 
    UpdateStudyGroupRequest, 
    StudyGroupResponse,
    StudyGroupListResponse
)
from ...services.study_group_service import StudyGroupService

router = APIRouter(prefix="/study-groups", tags=["study-groups"])

@router.post("/", response_model=StudyGroupResponse)
async def create_study_group(
    group_data: CreateStudyGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new study group"""
    group = StudyGroupService.create_group(db, group_data, current_user.id)
    response = StudyGroupResponse(**group.to_dict())
    response.is_member = True
    response.is_admin = True
    return response

@router.post("/{group_id}/join")
async def join_study_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Join a study group"""
    StudyGroupService.join_group(db, group_id, current_user.id)
    return {"message": "Successfully joined the study group"}

@router.post("/{group_id}/leave")
async def leave_study_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Leave a study group"""
    StudyGroupService.leave_group(db, group_id, current_user.id)
    return {"message": "Successfully left the study group"}

@router.put("/{group_id}", response_model=StudyGroupResponse)
async def update_study_group(
    group_id: int,
    update_data: UpdateStudyGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update study group (admin only)"""
    group = StudyGroupService.update_group(db, group_id, current_user.id, update_data)
    response = StudyGroupResponse(**group.to_dict())
    response.is_member = True
    return response

@router.delete("/{group_id}")
async def delete_study_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete study group (admin only)"""
    StudyGroupService.delete_group(db, group_id, current_user.id)
    return {"message": "Study group deleted successfully"}

@router.get("/my-groups", response_model=StudyGroupListResponse)
async def get_my_study_groups(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's study groups"""
    groups, total = StudyGroupService.get_user_groups(db, current_user.id, page, size)
    
    group_responses = []
    for group in groups:
        response = StudyGroupResponse(**group.to_dict())
        response.is_member = True
        group_responses.append(response)
    
    return StudyGroupListResponse(
        groups=group_responses,
        total=total,
        page=page,
        size=size
    )

@router.get("/search", response_model=StudyGroupListResponse)
async def search_study_groups(
    query: str = Query("", description="Search in name and description"),
    module: str = Query("", description="Filter by module"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search and browse study groups"""
    groups, total = StudyGroupService.search_groups(db, current_user.id, query, module, page, size)
    
    group_responses = []
    for group in groups:
        response = StudyGroupResponse(**group.to_dict())
        response.is_member = getattr(group, 'is_member', False)
        group_responses.append(response)
    
    return StudyGroupListResponse(
        groups=group_responses,
        total=total,
        page=page,
        size=size
    )

@router.get("/{group_id}", response_model=StudyGroupResponse)
async def get_study_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get study group details"""
    from ...models.study_group import StudyGroup
    from ...models.study_group_membership import StudyGroupMembership
    
    group = db.query(StudyGroup).filter(StudyGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study group not found"
        )
    
    # Check if user is member
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.is_active == True
    ).first()
    
    response = StudyGroupResponse(**group.to_dict())
    response.is_member = membership is not None
    response.is_admin = (membership is not None and membership.role == MemberRole.ADMIN)
    return response


# Get group members with optional online status
@router.get("/{group_id}/members")
async def get_group_members(
    group_id: int,
    include_online_status: bool = Query(True, description="Include online status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all members of a study group with optional online status"""
    if include_online_status:
        members = StudyGroupService.get_group_members_with_status(
            db, 
            group_id, 
            current_user.id
        )
    else:
        members = StudyGroupService.get_group_members_with_status(
            db, 
            group_id, 
            current_user.id
        )
    
    return members