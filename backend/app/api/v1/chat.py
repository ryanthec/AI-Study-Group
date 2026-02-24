# app/api/v1/chat.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
import json
import asyncio
import re
from jose import jwt, JWTError
from uuid import UUID

# Core and services
from ...core.database import get_db
from ...core.websocket_manager import manager
from ...core.security import get_current_user, get_user_from_token
from ...services.message_service import MessageService
from ...services.study_group_service import StudyGroupService
from ...services.rag_service import rag_service
from ...services.agent_config_service import AgentConfigService
from ...config import settings
from ...services.document_service import DocumentService

# Models
from ...models.study_group_membership import StudyGroupMembership
from ...models.study_group_message import StudyGroupMessage, MessageType
from ...models.user import User
from ...models.quiz import Quiz, QuizAttempt


# Schemas
from ...schemas.messages import MissedMessagesResponse, SummaryResponse

# Agents
from ...agents.teaching_agent import TeachingAssistantAgent, TAConfig, RAGMode, QuestionDifficulty
from ...agents.base_llm_model import BaseLLMModel
from ...agents.summarising_agent import SummarisingAgent


router = APIRouter(prefix="/chat", tags=["chat"])

# Singleton LLM Client (Keeps connections/session cache efficient)
base_llm = BaseLLMModel()

# Summarising Agent instance
summarising_agent = SummarisingAgent(base_llm)

# Factory to create TeachingAssistantAgent instances
def get_agent_for_group(group_id: int, db: Session) -> TeachingAssistantAgent:
    """
    Factory: Creates Agent instance using DB configuration.
    """
    # Fetch config from DB
    config = AgentConfigService.get_ta_config(db, group_id)
    
    # Create Agent
    return TeachingAssistantAgent(
        base_llm=base_llm,
        rag_service=rag_service,
        config=config # Pass the DB-loaded config
    )


@router.post("/extract_context")
async def extract_context_from_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing")
    try:
        content_bytes = await file.read()
        extracted_text = DocumentService.extract_text_from_bytes(file.filename, content_bytes)
        return { "filename": file.filename, "content": extracted_text }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")


# Helper function to fetch quiz context from DB
def fetch_quiz_context(db: Session, attempt_id: int, user_id: UUID) -> str:
    attempt = db.query(QuizAttempt).filter(
        QuizAttempt.id == attempt_id,
        QuizAttempt.user_id == user_id
    ).first()
    
    if not attempt:
        return ""

    quiz = db.query(Quiz).filter(Quiz.id == attempt.quiz_id).first()
    
    if attempt.total_questions > 0:
        is_passed = (attempt.score / attempt.total_questions) >= 0.5
    else:
        is_passed = False
        
    passed_str = "Yes" if is_passed else "No"
    
    # Construct a detailed context string
    context = f"""
    [SYSTEM CONTEXT: USER QUIZ ATTEMPT]
    Quiz Title: {quiz.title}
    Score: {attempt.score}/{attempt.total_questions}
    Passed: {passed_str}
    
    Gap Analysis Report:
    {attempt.analysis_report if attempt.analysis_report else "No analysis available."}
    """
    return context


def detect_ai_mention(content: str) -> bool:
    """Check if message mentions @Bob"""
    return "@Bob" in content or "@bob" in content.lower()

def remove_ai_mention(content: str) -> str:
    """Remove @Bob mention from message"""
    # Remove @Bob (case insensitive)
    cleaned = re.sub(r'@Bob\s*', '', content, flags=re.IGNORECASE)
    return cleaned.strip()

async def stream_ai_response(
    websocket: WebSocket, 
    group_id: int, 
    user_message: str, 
    username: str, 
    db: Session,
    session_id: Optional[str] = None,
    is_private: bool = False,
    recipient_id: Optional[UUID] = None,
    quiz_attempt_id: Optional[int] = None
):
    """Stream AI response through WebSocket"""
    try:
        teaching_agent = get_agent_for_group(group_id, db)

        # 1. Determine Session ID
        # If no custom session_id is provided, default to the public group session.
        # For private chat, the caller should pass "private_{group_id}_{user_id}"
        if not session_id:
            session_id = f"group_{group_id}"

        # Initialize session if it doesn't exist
        if not teaching_agent.base_llm.get_session(session_id):
            teaching_agent.create_session(session_id=session_id, group_id=group_id)

        
        # Add quiz attempt to context if necessary
        if quiz_attempt_id and recipient_id:
            quiz_context = fetch_quiz_context(db, quiz_attempt_id, recipient_id)
            if quiz_context:
                # We inject this as a system message into the session history directly
                # so the model "remembers" it for this turn
                teaching_agent.base_llm.add_message_to_history(
                    session_id=session_id,
                    role="system",
                    content=quiz_context
                )

        # 2. Prepare Context
        clean_question = remove_ai_mention(user_message)
        contextualized_question = f"{username}: {clean_question}"

        # 3. Send "AI is typing" indicator
        typing_payload = {
            "type": "ai_typing",
            "content": "Bob the Bot is thinking...",
            "username": username
        }

        # ROUTING LOGIC: Private vs Public
        if is_private:
            await websocket.send_json(typing_payload)
        else:
            await manager.broadcast_to_group(typing_payload, group_id)
        
        # 4. Stream AI response
        full_response = []
        active_config = AgentConfigService.get_ta_config(db, group_id)

        stream_generator = teaching_agent.answer_question_stream(
            session_id=session_id,
            group_id=group_id,
            question=contextualized_question,
            use_rag=True, 
            db_session=db,
            active_config=active_config
        )
        
        async for chunk in stream_generator:
            full_response.append(chunk)
            
            chunk_payload = {
                "type": "ai_stream",
                "content": chunk,
                "is_final": False
            }

            # ROUTING LOGIC
            if is_private:
                await websocket.send_json(chunk_payload)
            else:
                await manager.broadcast_to_group(chunk_payload, group_id)

            await asyncio.sleep(0.01)

        # 5. Finalize and Save
        complete_response = "".join(full_response)
        
        # Save AI response to Database
        # Uses the updated MessageService.create_message from the previous step
        ai_message = MessageService.create_message(
            db=db,
            group_id=group_id,
            user_id=None,  # AI has no user_id
            content=complete_response,
            message_type=MessageType.AI_RESPONSE,
            is_private=is_private,      # <--- New Flag
            recipient_id=recipient_id   # <--- New Link to User
        )
        
        final_payload = {
            "type": "ai_complete",
            "message": MessageService.format_message_for_ws(ai_message, db)
        }
        
        # ROUTING LOGIC
        if is_private:
            await websocket.send_json(final_payload)
        else:
            await manager.broadcast_to_group(final_payload, group_id)
        
    except Exception as e:
        print(f"[AI Stream Error] {str(e)}")
        error_payload = {
            "type": "ai_error",
            "content": "Sorry, I encountered an error. Please try again."
        }
        
        if is_private:
            await websocket.send_json(error_payload)
        else:
            await manager.broadcast_to_group(error_payload, group_id)



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

    
    # Register connection (adds to active_connections but doesn't broadcast yet)
    await manager.register(websocket, group_id, user)
    
    
    try:
        while True:
            try:
                text = await websocket.receive_text()

            except (WebSocketDisconnect, RuntimeError):
                break


            payload = json.loads(text)
            # Extract mode (default to 'public')
            chat_mode = payload.get("mode", "public") 
            content = payload.get("content", "").strip()


            # 1. HANDLE PRIVATE MODE
            if chat_mode == "private":
                # Save as Private Message
                user_msg = MessageService.create_message(
                    db=db, group_id=group_id, user_id=user.id,
                    content=content, message_type=MessageType.TEXT,
                    is_private=True, recipient_id=user.id
                )
                
                # Send ONLY to this user (echo back)
                await manager.send_personal_message(
                    MessageService.format_message_for_ws(user_msg, db), 
                    websocket
                )

                # Stream AI Response (Private Session)
                # Use a UNIQUE session ID for this user
                private_session_id = f"private_{group_id}_{user.id}"
                teaching_agent = get_agent_for_group(group_id, db)
                
                # Ensure session exists
                if not teaching_agent.base_llm.get_session(private_session_id):
                    teaching_agent.create_session(session_id=private_session_id, group_id=group_id)

                # === INJECT TEMPORARY CONTEXT (Hidden) ===
                # If the frontend sent extracted file text, we add it as a SYSTEM message.
                # This makes the AI "know" it, but it doesn't show up in the UI history.
                temp_context = payload.get("temporary_context", [])
                for item in temp_context:
                    title = item.get("title", "File")
                    text_content = item.get("content", "")
                    
                    # Inject into History (Hidden from User UI, visible to AI)
                    teaching_agent.base_llm.add_message_to_history(
                        session_id=private_session_id,
                        role="system", 
                        # We use 'system' or 'model' role so it acts as context
                        content=f"Context from uploaded file '{title}':\n{text_content}"
                    )
                # ==============================================

                # Stream AI Response
                await stream_ai_response(
                    websocket, group_id, content, user.username, db,
                    session_id=private_session_id,
                    is_private=True,
                    recipient_id=user.id,
                    quiz_attempt_id=payload.get("quiz_attempt_id")
                )

            # 2. HANDLE PUBLIC MODE
            else:
                # Handle client ready signal - client is ready to receive messages
                if payload.get("type") == "client_ready":
                    # Now that client is ready, send them the online users list
                    await manager.send_online_users_to_socket(websocket, group_id)
                    # And notify other users about the new connection
                    await manager.broadcast_online_users_to_others(group_id, websocket)
                    continue
                
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
        await manager.broadcast_online_users(group_id)


@router.get("/{group_id}/messages")
async def get_messages(
    group_id: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    mode: str = Query("public", regex="^(public|private)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    # 2. Fetch Based on Mode
    if mode == "private":
        messages = MessageService.get_private_messages(
            db, group_id, current_user.id, limit=limit, offset=offset
        )
    else:
        messages = MessageService.get_group_messages(
            db, group_id, limit=limit, offset=offset
        )
        
    return [MessageService.format_message_for_ws(m, db) for m in messages]


# Endpoints for missed message count and summarisation
@router.get("/groups/{group_id}/missed_count", response_model=MissedMessagesResponse)
def get_missed_message_count(
    group_id: int,
    current_user: User = Depends(get_current_user), # Assuming you have this dep
    db: Session = Depends(get_db)
):
    # 1. Get Membership to find last_viewed_at
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member")
        
    last_viewed = membership.last_viewed_at
    
    # If never viewed, assume they missed everything (or handle as 0 if new joiner logic prefers)
    if not last_viewed:
        count = db.query(StudyGroupMessage).filter(
            StudyGroupMessage.group_id == group_id
        ).count()
        return MissedMessagesResponse(missed_count=count, last_viewed=None)

    # 2. Count messages created > last_viewed
    count = db.query(StudyGroupMessage).filter(
        StudyGroupMessage.group_id == group_id,
        StudyGroupMessage.created_at > last_viewed
    ).count()
    
    return MissedMessagesResponse(
        missed_count=count, 
        last_viewed=last_viewed.isoformat()
    )


@router.post("/groups/{group_id}/update_viewed")
def update_last_viewed(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id
    ).first()
    
    if membership:
        membership.last_viewed_at = datetime.now(timezone.utc)
        db.commit()
    
    return {"status": "updated"}


@router.post("/groups/{group_id}/summarise_missed", response_model=SummaryResponse)
async def summarise_missed_messages(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Get last viewed
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id
    ).first()
    
    if not membership or not membership.last_viewed_at:
        # Fallback: Summarise last 50 messages if no timestamp
        messages = MessageService.get_group_messages(db, group_id, limit=50)
    else:
        # 2. Fetch missed messages
        # Note: MessageService might need a new method or we query directly here
        messages_orm = db.query(StudyGroupMessage).filter(
            StudyGroupMessage.group_id == group_id,
            StudyGroupMessage.created_at > membership.last_viewed_at
        ).order_by(StudyGroupMessage.created_at.asc()).all()
        
        # Limit to avoid token overflow (e.g., max 100 recent missed messages)
        if len(messages_orm) > 150:
            messages_orm = messages_orm[-150:]
            
        messages = messages_orm

    if not messages:
        return SummaryResponse(summary="No missed messages to summarise.")

    # 3. Format for Agent
    formatted_msgs = []
    for m in messages:
        # Resolving username might require a join or helper, assuming simple access here
        username = m.user.username if m.user else "Bob the Bot"
        formatted_msgs.append({"username": username, "content": m.content})

    # 4. Generate
    summary_text = await summarising_agent.summarise_chat(formatted_msgs)
    
    return SummaryResponse(summary=summary_text)