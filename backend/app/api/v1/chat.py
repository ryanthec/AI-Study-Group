# app/api/v1/chat.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import json
import asyncio
from jose import jwt, JWTError

# Core and services
from ...core.database import get_db
from ...core.websocket_manager import manager
from ...services.message_service import MessageService
from ...services.study_group_service import StudyGroupService
from ...config import settings

# Models
from ...models.study_group_membership import StudyGroupMembership
from ...models.study_group_message import MessageType
from ...models.user import User

# Agents
from ...agents.teaching_agent import TeachingAssistantAgent, TAConfig, RAGMode, QuestionDifficulty
from ...agents.base_llm_model import BaseLLMModel

router = APIRouter(prefix="/chat", tags=["chat"])


# Initialize Teaching Agent (singleton for all groups)
base_llm = BaseLLMModel()
teaching_agent = TeachingAssistantAgent(
    base_llm=base_llm,
    rag_service=None,  # Add RAG later after RAG toggle is implemented
    config=TAConfig(
        rag_mode=RAGMode.DISABLED,
        use_socratic_prompting=True,
        temperature=0.7,
        socratic_prompt_limit_factual=1,
        socratic_prompt_limit_conceptual=2,
        socratic_prompt_limit_applied=2,
        socratic_prompt_limit_complex=3,
    )
)


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

def detect_ai_mention(content: str) -> bool:
    """Check if message mentions @TeachingAI"""
    return "@TeachingAI" in content or "@teachingai" in content.lower()

def remove_ai_mention(content: str) -> str:
    """Remove @TeachingAI mention from message"""
    import re
    # Remove @TeachingAI (case insensitive)
    cleaned = re.sub(r'@TeachingAI\s*', '', content, flags=re.IGNORECASE)
    return cleaned.strip()

async def stream_ai_response(websocket: WebSocket, group_id: int, user_message: str, username: str, db: Session):
    """Stream AI response through WebSocket"""
    try:
        # Get or create session for this group
        session_id = f"group_{group_id}"
        if not teaching_agent.base_llm.get_session(session_id):
            teaching_agent.create_session(session_id=session_id, group_id=group_id)
        
        # Clean the user message (remove @TeachingAI mention)
        clean_question = remove_ai_mention(user_message)
        
        # Send "AI is typing" indicator
        await manager.broadcast_to_group(
            {
                "type": "ai_typing",
                "content": "TeachingAI is thinking...",
                "username": username
            },
            group_id
        )
        
        # Stream AI response
        full_response = []

        # Get the async generator
        stream_generator = teaching_agent.answer_question_stream(
            session_id=session_id,
            group_id=group_id,
            question=clean_question,
            use_rag=False, #Update later when RAG is implemented
            db_session=None
        )
        
        # Use async for to iterate
        async for chunk in stream_generator:
            full_response.append(chunk)
            # Stream each chunk to all group members
            await manager.broadcast_to_group(
                {
                    "type": "ai_stream",
                    "content": chunk,
                    "is_final": False
                },
                group_id
            )

            # Small delay to prevent overwhelming the connection
            await asyncio.sleep(0.01)

        # Join full response
        complete_response = "".join(full_response)
        
        # Save AI response as a message in database
        ai_message = MessageService.create_message(
            db=db,
            group_id=group_id,
            user_id=None,  # AI has no user_id
            content=complete_response,
            message_type=MessageType.AI_RESPONSE
        )
        
        # Send final message with database ID
        await manager.broadcast_to_group(
            {
                "type": "ai_complete",
                "message": MessageService.format_message_for_ws(ai_message, db)
            },
            group_id
        )
        
    except Exception as e:
        print(f"[AI Stream Error] {str(e)}")
        await manager.broadcast_to_group(
            {
                "type": "ai_error",
                "content": "Sorry, I encountered an error. Please try again."
            },
            group_id
        )

@router.websocket("/ws/{group_id}")
async def websocket_endpoint(websocket: WebSocket, group_id: int, db: Session = Depends(get_db)):
    await websocket.accept()
    
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Missing token")
        return
    
    user = get_user_from_token(token, db)
    if not user:
        await websocket.close(code=1008, reason="Invalid/expired token")
        return
    
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == user.id,
        StudyGroupMembership.is_active == True
    ).first()
    
    if not membership:
        await websocket.close(code=1008, reason="Not a member")
        return
    
    # Mark user as online
    StudyGroupService.mark_user_online(group_id, user.id)
    
    # Register connection
    await manager.register(websocket, group_id)
    
    # System join message
    join = MessageService.create_message(
        db=db, group_id=group_id, user_id=None,
        content=f"{user.username} joined the chat", message_type=MessageType.SYSTEM
    )
    await manager.broadcast_to_group(MessageService.format_message_for_ws(join, db), group_id)
    
    try:
        while True:
            try:
                text = await websocket.receive_text()
            except (WebSocketDisconnect, RuntimeError):
                break
            
            payload = json.loads(text)
            content = payload.get("content", "").strip()
            
            if not content:
                continue
            
            # Check if message mentions AI
            if detect_ai_mention(content):
                # Save user's message first
                user_msg = MessageService.create_message(
                    db=db, group_id=group_id, user_id=user.id,
                    content=content, message_type=MessageType.TEXT
                )
                await manager.broadcast_to_group(
                    MessageService.format_message_for_ws(user_msg, db), 
                    group_id
                )
                
                # Stream AI response
                await stream_ai_response(websocket, group_id, content, user.username, db)
            else:
                # Regular user message
                msg = MessageService.create_message(
                    db=db, group_id=group_id, user_id=user.id,
                    content=content, message_type=MessageType.TEXT
                )
                await manager.broadcast_to_group(
                    MessageService.format_message_for_ws(msg, db), 
                    group_id
                )
    
    finally:
        manager.disconnect(websocket, group_id)
        leave = MessageService.create_message(
            db=db, group_id=group_id, user_id=None,
            content=f"{user.username} left the chat", message_type=MessageType.SYSTEM
        )
        StudyGroupService.mark_user_offline(group_id, user.id)
        await manager.broadcast_to_group(MessageService.format_message_for_ws(leave, db), group_id)
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
