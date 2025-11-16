# app/api/v1/chat.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.websocket_manager import manager
from ...services.message_service import MessageService
from ...models.study_group_membership import StudyGroupMembership
from ...models.study_group_message import MessageType
from ...models.user import User
from ...services.study_group_service import StudyGroupService
import json
from jose import jwt, JWTError
from ...config import settings

router = APIRouter(prefix="/chat", tags=["chat"])

def get_user_from_token(token: str, db: Session) -> User | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        email = payload.get("sub")
        if not isinstance(email, str):
            return None
        return db.query(User).filter(User.email == email).first()
    except JWTError as e:
        print(f"[WS] JWT decode failed: {e}")
        return None

@router.websocket("/ws/{group_id}")
async def websocket_endpoint(websocket: WebSocket, group_id: int, db: Session = Depends(get_db)):
    # Accept first so client sees proper close codes instead of a generic 1006
    await websocket.accept()
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Missing token"); return
    user = get_user_from_token(token, db)
    if not user:
        await websocket.close(code=1008, reason="Invalid/expired token"); return
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == user.id,
        StudyGroupMembership.is_active == True
    ).first()
    if not membership:
        await websocket.close(code=1008, reason="Not a member"); return

    # Mark user as online
    StudyGroupService.mark_user_online(group_id, user.id)

    # Register the (now-accepted) connection
    await manager.register(websocket, group_id)  # see manager change below

    # System join
    join = MessageService.create_message(
        db=db, group_id=group_id, user_id=None,
        content=f"{user.username} joined the chat", message_type=MessageType.SYSTEM
    )
    await manager.broadcast_to_group(MessageService.format_message_for_ws(join, db), group_id)

    try:
        while True:
            try:
                text = await websocket.receive_text()
            except WebSocketDisconnect:
                break
            except RuntimeError:
                # Socket no longer connected
                break

            payload = json.loads(text)
            msg = MessageService.create_message(
                db=db, group_id=group_id, user_id=user.id,
                content=payload.get("content", ""), message_type=MessageType.TEXT
            )
            await manager.broadcast_to_group(MessageService.format_message_for_ws(msg, db), group_id)
    finally:
        manager.disconnect(websocket, group_id)
        leave = MessageService.create_message(
            db=db, group_id=group_id, user_id=None,
            content=f"{user.username} left the chat", message_type=MessageType.SYSTEM
        )
        StudyGroupService.mark_user_offline(group_id, user.id)
        await manager.broadcast_to_group(MessageService.format_message_for_ws(leave, db), group_id)
        
        # Broadcast updated user count after user leaves
        await manager.broadcast_user_count(group_id)


@router.get("/{group_id}/messages")
async def get_messages(
    group_id: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    token: str | None = None,
):
    user = get_user_from_token(token, db) if token else None
    if user:
        membership = db.query(StudyGroupMembership).filter(
            StudyGroupMembership.group_id == group_id,
            StudyGroupMembership.user_id == user.id,
            StudyGroupMembership.is_active == True
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this group")
    messages = MessageService.get_group_messages(db, group_id, limit=limit, offset=offset)
    return [MessageService.format_message_for_ws(m, db) for m in messages]
