from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException, status
from datetime import datetime, timedelta
from typing import List, Optional
from ..models.study_group import StudyGroup, StudyGroupStatus
from ..models.study_group_membership import StudyGroupMembership, MemberRole
from ..models.study_group_message import StudyGroupMessage, MessageType
from ..schemas.study_group import CreateStudyGroupRequest, UpdateStudyGroupRequest

class StudyGroupService:

    active_chat_sessions = {}
    
    @staticmethod
    def mark_user_online(group_id: int, user_id: int):
        """Mark user as online in a specific group"""
        key = (group_id, user_id)
        StudyGroupService.active_chat_sessions[key] = datetime.utcnow()
    
    @staticmethod
    def mark_user_offline(group_id: int, user_id: int):
        """Mark user as offline in a specific group"""
        key = (group_id, user_id)
        if key in StudyGroupService.active_chat_sessions:
            del StudyGroupService.active_chat_sessions[key]
    
    @staticmethod
    def is_user_online(group_id: int, user_id: int) -> bool:
        """Check if user is online in a specific group"""
        key = (group_id, user_id)
        if key not in StudyGroupService.active_chat_sessions:
            return False
        
        # Consider offline if session is older than 5 minutes
        last_active = StudyGroupService.active_chat_sessions[key]
        timeout = datetime.utcnow() - timedelta(minutes=5)
        
        if last_active < timeout:
            del StudyGroupService.active_chat_sessions[key]
            return False
        
        return True
    
    @staticmethod
    def get_group_members_with_status(db: Session, group_id: int, current_user_id: int):
        """Get all members with their current online status"""
        from ..models.user import User
        
        # Verify user is a member
        membership = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == current_user_id,
            StudyGroupMembership.is_active == True
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this study group"
            )
        
        # Get all active members
        members = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.is_active == True
        ).all()
        
        members_data = []
        for member in members:
            user = member.user
            is_online = StudyGroupService.is_user_online(group_id, user.id)
            
            members_data.append({
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "avatar": getattr(user, 'avatar_url', None),
                "role": member.role.value,
                "joinedAt": member.created_at.isoformat() if hasattr(member, 'created_at') else None,
                "isOnline": is_online
            })
        
        return members_data

    @staticmethod
    def create_group(db: Session, group_data: CreateStudyGroupRequest, creator_id: int) -> StudyGroup:
        # Check user's group limit (max 5 active memberships)
        user_groups = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.user_id == creator_id,
            StudyGroupMembership.is_active == True
        ).count()
        
        if user_groups >= 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum of 5 active group memberships allowed"
            )

        # Create group
        db_group = StudyGroup(
            name=group_data.name,
            description=group_data.description,
            module=group_data.module,
            max_members=group_data.max_members,
            creator_id=creator_id
        )
        
        db.add(db_group)
        db.flush()  # Get the ID
        
        # Add creator as admin member
        membership = StudyGroupMembership(
            user_id=creator_id,
            group_id=db_group.id,
            role=MemberRole.ADMIN,
            is_active=True,
        )
        db.add(membership)
        
        # Add system message
        welcome_msg = StudyGroupMessage(
            group_id=db_group.id,
            content=f"Study group '{db_group.name}' created!",
            message_type=MessageType.SYSTEM
        )
        db.add(welcome_msg)
        
        db.commit()
        db.refresh(db_group)
        return db_group

    @staticmethod
    def join_group(db: Session, group_id: int, user_id: int) -> StudyGroupMembership:
        # Check if group exists and is active
        group = db.query(StudyGroup).filter(
            StudyGroup.id == group_id,
            StudyGroup.status == StudyGroupStatus.ACTIVE
        ).first()
        
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study group not found or inactive"
            )

        # Check if already a member
        existing = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user_id,
            StudyGroupMembership.is_active == True
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already a member of this group"
            )

        # Check group capacity
        current_members = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.is_active == True
        ).count()
        
        if current_members >= group.max_members:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Study group is full"
            )

        # Check user's group limit
        user_groups = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.user_id == user_id,
            StudyGroupMembership.is_active == True
        ).count()
        
        if user_groups >= 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum of 5 active group memberships allowed"
            )

        # Create membership
        membership = StudyGroupMembership(
            user_id=user_id,
            group_id=group_id,
            role=MemberRole.MEMBER
        )
        db.add(membership)
        
        # Add join message
        from ..models.user import User
        user = db.query(User).filter(User.id == user_id).first()
        join_msg = StudyGroupMessage(
            group_id=group_id,
            content=f"{user.username} joined the group",
            message_type=MessageType.SYSTEM
        )
        db.add(join_msg)
        
        db.commit()
        db.refresh(membership)
        return membership

    @staticmethod
    def leave_group(db: Session, group_id: int, user_id: int):
        membership = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user_id,
            StudyGroupMembership.is_active == True
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membership not found"
            )

        # If admin leaves, transfer admin to another member or delete group
        if membership.role == MemberRole.ADMIN:
            other_members = db.query(StudyGroupMembership).filter(
                StudyGroupMembership.group_id == group_id,
                StudyGroupMembership.user_id != user_id,
                StudyGroupMembership.is_active == True
            ).first()
            
            if other_members:
                other_members.role = MemberRole.ADMIN
            else:
                # No other members, delete the group
                StudyGroupService.delete_group(db, group_id, user_id)
                return

        # Deactivate membership
        membership.is_active = False
        
        # Add leave message
        from ..models.user import User
        user = db.query(User).filter(User.id == user_id).first()
        leave_msg = StudyGroupMessage(
            group_id=group_id,
            content=f"{user.username} left the group",
            message_type=MessageType.SYSTEM
        )
        db.add(leave_msg)
        
        db.commit()

    @staticmethod
    def update_group(db: Session, group_id: int, user_id: int, update_data: UpdateStudyGroupRequest) -> StudyGroup:
        # Check if user is admin
        membership = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user_id,
            StudyGroupMembership.role == MemberRole.ADMIN,
            StudyGroupMembership.is_active == True
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group admin can update the group"
            )

        group = db.query(StudyGroup).filter(StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study group not found"
            )

        # Update fields
        for field, value in update_data.dict(exclude_unset=True).items():
            setattr(group, field, value)
        
        group.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def delete_group(db: Session, group_id: int, user_id: int):
        # Check if user is admin
        membership = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user_id,
            StudyGroupMembership.role == MemberRole.ADMIN,
            StudyGroupMembership.is_active == True
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group admin can delete the group"
            )

        group = db.query(StudyGroup).filter(StudyGroup.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Study group not found"
            )

        # Soft delete - mark as cancelled
        group.status = StudyGroupStatus.CANCELLED
        group.updated_at = datetime.utcnow()
        
        # Deactivate all memberships
        db.query(StudyGroupMembership).filter(
            StudyGroupMembership.group_id == group_id
        ).update({"is_active": False})
        
        db.commit()

    @staticmethod
    def get_user_groups(db: Session, user_id: int, page: int = 1, size: int = 10):
        offset = (page - 1) * size
        
        query = db.query(StudyGroup).join(StudyGroupMembership).filter(
            StudyGroupMembership.user_id == user_id,
            StudyGroupMembership.is_active == True,
            StudyGroup.status == StudyGroupStatus.ACTIVE
        )
        
        total = query.count()
        groups = query.offset(offset).limit(size).all()
        
        return groups, total

    @staticmethod
    def search_groups(db: Session, user_id: int, query: str = "", module: str = "", page: int = 1, size: int = 10):
        offset = (page - 1) * size
        
        # Base query for active groups
        db_query = db.query(StudyGroup).filter(
            StudyGroup.status == StudyGroupStatus.ACTIVE
        )
        
        # Apply filters
        if query:
            db_query = db_query.filter(
                or_(
                    StudyGroup.name.ilike(f"%{query}%"),
                    StudyGroup.description.ilike(f"%{query}%")
                )
            )
        
        if module:
            db_query = db_query.filter(StudyGroup.module.ilike(f"%{module}%"))
        
        total = db_query.count()
        groups = db_query.offset(offset).limit(size).all()
        
        # Add membership info
        for group in groups:
            membership = db.query(StudyGroupMembership).filter(
                StudyGroupMembership.group_id == group.id,
                StudyGroupMembership.user_id == user_id,
                StudyGroupMembership.is_active == True
            ).first()
            group.is_member = membership is not None
            group.is_admin = membership.role == MemberRole.ADMIN if membership else False
        
        return groups, total


