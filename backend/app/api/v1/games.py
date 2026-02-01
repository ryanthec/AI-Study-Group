import mimetypes
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, logger
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json
import logging
import asyncio

from ...core.database import get_db
from ...core.security import get_current_user
from ...core.game_manager import game_manager
from ...models.user import User
from ...models.game import GameDifficulty, GameSession, GameParticipant, GameStatus
from ...models.study_group_membership import StudyGroupMembership
from ...services.document_service import DocumentService
from ...models.document_embedding import Document
from ...agents.base_llm_model import BaseLLMModel

router = APIRouter(prefix="/games", tags=["games"])

class CreateGameRequest(BaseModel):
    topic: str
    num_cards: int = 10
    document_ids: List[int] = []
    difficulty: str = "medium"

# Helper to guess mime type (mime is the file type from the binary data stored in the documents table)
def _get_mime_type(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    if mime: return mime
    if filename.endswith(".pdf"): return "application/pdf"
    if filename.endswith(".docx"): return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return "text/plain"

@router.post("/groups/{group_id}/create")
async def create_game(
    group_id: int,
    request: CreateGameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify Membership
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id, 
        StudyGroupMembership.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # 2. Retrieve and Upload Documents
    # We must retrieve the 'file_data' (bytes) and upload to Gemini
    uploaded_files = []
    
    if request.document_ids:
        docs = db.query(Document).filter(
            Document.id.in_(request.document_ids),
            Document.group_id == group_id
        ).all()
        
        llm_client = BaseLLMModel()

        for doc in docs:
            if doc.file_data:
                mime_type = _get_mime_type(doc.filename)
                try:
                    # Use the helper from BaseLLMModel to upload bytes
                    file_ref = llm_client.upload_file_from_bytes(
                        file_bytes=doc.file_data,
                        mime_type=mime_type,
                        display_name=doc.filename
                    )
                    uploaded_files.append(file_ref)
                except Exception as e:
                    logger.error(f"Failed to upload document {doc.filename}: {e}")

    # 3. Generate Flashcards using LLM with File Context
    llm = BaseLLMModel()


    difficulty_instructions = {
        "easy": "Focus on high-level definitions and basic terminology. Options should be clearly distinct.",
        "medium": "Focus on application of concepts and standard edge cases. Options should be plausible.",
        "hard": "Focus on specific details, complex relationships, or 'trick' questions. Options should be very similar to test precision. HOWEVER, the question MUST remain short enough to read and solve within 15 seconds."
    }

    instruction = difficulty_instructions.get(request.difficulty.lower(), difficulty_instructions["medium"])

    
    # Prompt explicitly asking to use the provided context and difficulty instructions
    prompt = f"""
    You are a Flashcard Generator for a speed-round game.
    Task: Generate {request.num_cards} flashcards based on the provided documents.
    Topic Focus: {request.topic} (Prioritize this topic within the documents).

    Difficulty Level: {request.difficulty.upper()}
    
    Specific Instructions for {request.difficulty.upper()}:
    {instruction}

    Format: Return ONLY a raw JSON list of objects. No markdown formatting.
    Structure:
    [
      {{
        "front": "Question or Term (e.g., 'What is the time complexity of QuickSort?')",
        "back": "The correct answer (e.g., 'O(n log n)')",
        "options": ["O(n log n)", "O(n^2)", "O(1)", "O(log n)"] 
      }}
    ]
    
    Constraints:
    - "options" must contain exactly 4 strings.
    - "back" must match exactly one of the strings in "options".
    - Questions must be derived directly from the attached documents.
    - The question text must be concise (under 20 words if possible).
    - Players only have 15 seconds. Do not generate paragraphs or complex scenarios.

    """
    
    try:
        # Use generate_stateless_response which handles attachments correctly
        response = await llm.generate_stateless_response(
            prompt=prompt,
            attachments=uploaded_files,
            max_output_tokens=4000
        )
        
        clean_json = response.replace("```json", "").replace("```", "").strip()
        cards = json.loads(clean_json)
        
    except Exception as e:
        logger.error(f"LLM Generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate game content")

    # 4. Create Game Session
    session = GameSession(
        study_group_id=group_id,
        host_id=current_user.id,
        topic=request.topic,
        difficulty=GameDifficulty(request.difficulty.lower()),
        status=GameStatus.LOBBY,
        cards=cards,
        current_card_index=-1
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return {"game_id": session.id}

@router.get("/groups/{group_id}/active")
def list_active_games(group_id: int, db: Session = Depends(get_db)):
    games = db.query(GameSession).filter(
        GameSession.study_group_id == group_id,
        GameSession.status != GameStatus.FINISHED
    ).all()
    return [{"id": g.id, "topic": g.topic, "status": g.status.value, "host_id": str(g.host_id)} for g in games]

@router.websocket("/{game_id}/ws")
async def game_websocket(
    websocket: WebSocket,
    game_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    # (Add Token Validation here similar to chat.py)
    # ... assuming 'user' is valid ...
    user = ... # Retrieve user from token
    
    # Add to DB participant if not exists
    participant = db.query(GameParticipant).filter_by(session_id=game_id, user_id=user.id).first()
    if not participant:
        participant = GameParticipant(session_id=game_id, user_id=user.id)
        db.add(participant)
        db.commit()

    await game_manager.connect(websocket, game_id, str(user.id), user.username)
    
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            # --- HOST: START GAME ---
            if action == "start_game":
                session = db.query(GameSession).get(game_id)
                if str(session.host_id) == str(user.id):
                    session.status = GameStatus.IN_PROGRESS
                    session.current_card_index = 0
                    db.commit()
                    # Send First Card
                    await game_manager.send_next_card(game_id, session.cards[0])

            # --- PLAYER: SUBMIT ANSWER ---
            elif action == "answer":
                answer = data.get("value")
                session = db.query(GameSession).get(game_id)
                current_card = session.cards[session.current_card_index]
                
                # Check correctness
                if answer == current_card["back"]:
                    # Calculate points based on speed (mock logic)
                    points = 100 + (participant.streak * 10)
                    participant.score += points
                    participant.streak += 1
                else:
                    participant.streak = 0
                db.commit()

            # --- HOST: NEXT CARD ---
            elif action == "next_card":
                # Host triggers next card manually or after timer
                session = db.query(GameSession).get(game_id)
                
                # 1. Send results of previous round
                leaderboard = db.query(GameParticipant).filter_by(session_id=game_id).order_by(GameParticipant.score.desc()).all()
                lb_data = [{"username": p.user.username, "score": p.score} for p in leaderboard]
                prev_card = session.cards[session.current_card_index]
                await game_manager.send_round_result(game_id, prev_card["back"], lb_data)
                
                # 2. Advance index
                session.current_card_index += 1
                if session.current_card_index < len(session.cards):
                    db.commit()
                    # Small delay then send next card
                    await asyncio.sleep(3) 
                    await game_manager.send_next_card(game_id, session.cards[session.current_card_index])
                else:
                    session.status = GameStatus.FINISHED
                    db.commit()
                    await game_manager.broadcast(game_id, {"type": "game_over", "leaderboard": lb_data})

    except WebSocketDisconnect:
        game_manager.disconnect(websocket, game_id)