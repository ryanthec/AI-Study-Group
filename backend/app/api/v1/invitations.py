from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from pydantic import BaseModel, EmailStr

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.study_group import StudyGroup
from ...models.study_group_membership import StudyGroupMembership, MemberRole
from ...models.group_invitation import GroupInvitation
from ...services.email_service import email_service

router = APIRouter(prefix="/invitations", tags=["invitations"])

class InvitationCreate(BaseModel):
    email: EmailStr

class InvitationResponse(BaseModel):
    id: int
    invitee_email: str
    is_accepted: bool
    expires_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.post("/{group_id}")
async def send_invitation(
    group_id: int,
    invitation: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send invitation to join a study group (admin only)"""
    
    # Check if user is admin of the group
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.role == MemberRole.ADMIN,
        StudyGroupMembership.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admins can send invitations"
        )
    
    # Get group details
    group = db.query(StudyGroup).filter(StudyGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    

    # Require existing user
    invitee = db.query(User).filter(User.email == invitation.email).first()
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found. Ask them to register first.")


    # Check if user is already a member
    existing_user = db.query(User).filter(User.email == invitation.email).first()
    if existing_user:
        existing_membership = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == existing_user.id,
            StudyGroupMembership.is_active == True
        ).first()
        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this group"
            )
    
    # Check if there's already a pending invitation
    pending_invitation = db.query(GroupInvitation).filter(
        GroupInvitation.group_id == group_id,
        GroupInvitation.invitee_email == invitation.email,
        GroupInvitation.is_accepted == False,
        GroupInvitation.expires_at > datetime.utcnow()
    ).first()
    
    if pending_invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An invitation has already been sent to this email"
        )
    
    # Create invitation
    new_invitation = GroupInvitation.create_invitation(
        group_id=group_id,
        inviter_id=current_user.id,
        invitee_email=invitation.email
    )
    
    db.add(new_invitation)
    db.commit()
    db.refresh(new_invitation)
    
    # Send email
    email_sent = email_service.send_invitation_email(
        invitee_email=invitation.email,
        inviter_name=current_user.username,
        group_name=group.name,
        token=new_invitation.token
    )
    
    if not email_sent:
        # Still return success but log the email failure
        print(f"Warning: Invitation created but email failed to send")
    
    return {
        "message": "Invitation sent successfully",
        "invitation_id": new_invitation.id
    }

@router.get("/{group_id}", response_model=List[InvitationResponse])
async def get_group_invitations(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all pending invitations for a group (admin only)"""
    
    # Check if user is admin
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.role == MemberRole.ADMIN,
        StudyGroupMembership.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admins can view invitations"
        )
    
    invitations = db.query(GroupInvitation).filter(
        GroupInvitation.group_id == group_id,
        GroupInvitation.is_accepted == False,
        GroupInvitation.expires_at > datetime.utcnow()
    ).all()
    
    return invitations

@router.post("/accept/{token}")
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a study group invitation"""
    
    # Find invitation
    invitation = db.query(GroupInvitation).filter(
        GroupInvitation.token == token
    ).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )
    
    # Check if expired
    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has expired"
        )
    
    # Check if already accepted
    if invitation.is_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has already been accepted"
        )
    
    # Verify email matches current user
    if invitation.invitee_email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was not sent to your email address"
        )
    
    # Check if already a member
    existing_membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == invitation.group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.is_active == True
    ).first()
    
    if existing_membership:
        invitation.is_accepted = True
        db.commit()
        return {"message": "You are already a member of this group"}
    
    # Create membership
    new_membership = StudyGroupMembership(
        group_id=invitation.group_id,
        user_id=current_user.id,
        role=MemberRole.MEMBER,
        is_active=True,
        joined_at=datetime.utcnow()
    )
    
    invitation.is_accepted = True
    
    db.add(new_membership)
    db.commit()
    
    return {
        "message": "Successfully joined the study group",
        "group_id": invitation.group_id
    }

@router.delete("/{invitation_id}")
async def cancel_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel/delete an invitation (admin only)"""
    
    invitation = db.query(GroupInvitation).filter(
        GroupInvitation.id == invitation_id
    ).first()
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    # Check if user is admin of the group
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == invitation.group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.role == MemberRole.ADMIN,
        StudyGroupMembership.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group admins can cancel invitations"
        )
    
    db.delete(invitation)
    db.commit()
    
    return {"message": "Invitation cancelled successfully"}
