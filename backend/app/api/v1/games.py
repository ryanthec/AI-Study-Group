import mimetypes
from typing import Dict, List, Optional
import json
import logging
import asyncio
import httpx
import html
import re
import ast
import random

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from pydantic import BaseModel


from ...core.database import SessionLocal, get_db
from ...core.security import get_current_user, get_user_from_token
from ...core.game_manager import game_manager
from ...models.user import User
from ...models.game import GameDifficulty, GameSession, GameParticipant, GameStatus
from ...models.study_group_membership import StudyGroupMembership
from ...services.document_service import DocumentService
from ...models.document_embedding import Document
from ...agents.base_llm_model import BaseLLMModel

router = APIRouter(prefix="/games", tags=["games"])

logger = logging.getLogger(__name__)

# --- In-Memory Session Token Store for Trivia questions---
# Map: user_id -> session_token
# Session tokens are sent with the API request to avoid getting duplicate questions
opentdb_tokens: Dict[str, str] = {}


class CreateGameRequest(BaseModel):
    topic: str
    num_cards: int = 10
    document_ids: List[int] = []
    difficulty: str = "medium"
    time_limit: int = 15
    mode: str = "study" # 'study' or 'trivia'
    trivia_category: Optional[str] = None # OpenTDB Category ID

# Helper to guess mime type (mime is the file type from the binary data stored in the documents table)
def _get_mime_type(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    if mime: return mime
    if filename.endswith(".pdf"): return "application/pdf"
    if filename.endswith(".docx"): return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return "text/plain"

# Helper for LLM response JSON Parsing
def parse_llm_json(response_text: str):
    """
    Robust JSON parsing for LLM outputs.
    Handles trailing commas and Python-style dicts without breaking text content.
    """
    # 1. Extract content between first [ and last ]
    match = re.search(r'\[.*\]', response_text, re.DOTALL)
    if not match:
        raise ValueError("No JSON list found in response")
    
    json_str = match.group(0)

    # Attempt 1: Standard Strict JSON
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass

    # Attempt 2: Fix Trailing Commas (Common LLM error)
    # Regex: Finds a comma followed by whitespace and then a closing bracket/brace
    # Replaces ", ]" with "]"
    try:
        fixed_str = re.sub(r',\s*([\]}])', r'\1', json_str)
        return json.loads(fixed_str)
    except json.JSONDecodeError:
        pass

    # Attempt 3: Python Literal Eval (Handles single quotes correctly)
    # We explicitly map JSON keywords to Python keywords to avoid syntax errors
    try:
        # Create a safe copy that maps JSON booleans/null to Python
        # Note: We use a regex word boundary \b to avoid replacing "true" inside a word
        py_str = json_str
        py_str = re.sub(r'\bnull\b', 'None', py_str)
        py_str = re.sub(r'\btrue\b', 'True', py_str)
        py_str = re.sub(r'\bfalse\b', 'False', py_str)
        return ast.literal_eval(py_str)
    except (ValueError, SyntaxError):
        pass

    # If all fail, raise the original error from Attempt 1 (most descriptive)
    return json.loads(json_str)


# --- OpenTDB Logic ---
# Credit for API from open trivia db: https://opentdb.com/api_config.php
async def fetch_opentdb_token(user_id: str) -> str:
    """Gets or refreshes a session token for the user."""
    if user_id in opentdb_tokens:
        return opentdb_tokens[user_id]
    
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://opentdb.com/api_token.php?command=request")
        data = resp.json()
        if data['response_code'] == 0:
            token = data['token']
            opentdb_tokens[user_id] = token
            return token
        else:
            logger.error(f"Failed to get OpenTDB token: {data}")
            return ""

async def reset_opentdb_token(user_id: str, token: str):
    """Resets the token if questions are exhausted."""
    async with httpx.AsyncClient() as client:
        await client.get(f"https://opentdb.com/api_token.php?command=reset&token={token}")

async def fetch_trivia_questions(amount: int, category: Optional[str], difficulty: str, user_id: str):
    token = await fetch_opentdb_token(user_id)
    
    # Map difficulty to OpenTDB format (easy, medium, hard)
    diff_param = difficulty.lower()
    
    url = f"https://opentdb.com/api.php?amount={amount}&type=multiple&difficulty={diff_param}"
    if category and category != "any":
        url += f"&category={category}"
    if token:
        url += f"&token={token}"
        
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        data = resp.json()
        
        # Handle Response Codes
        code = data.get('response_code', 0)
        
        # Code 4: Token Empty (Exhausted questions). Reset and retry once.
        if code == 4 and token:
            logger.info(f"OpenTDB Token exhausted for user {user_id}. Resetting...")
            await reset_opentdb_token(user_id, token)
            # Retry call
            resp = await client.get(url)
            data = resp.json()
            
        # Code 3: Token Not Found. Clear and retry with new token.
        elif code == 3:
            if user_id in opentdb_tokens: del opentdb_tokens[user_id]
            token = await fetch_opentdb_token(user_id)
            url = url.replace(f"&token={opentdb_tokens.get(user_id, '')}", f"&token={token}")
            resp = await client.get(url)
            data = resp.json()

        if data.get('response_code') != 0:
            raise HTTPException(status_code=500, detail=f"Failed to fetch trivia: Code {data.get('response_code')}")

        # Format Questions to match our Game Card structure
        formatted_cards = []
        for item in data.get('results', []):
            # Decode HTML entities (e.g. &quot; -> ")
            question_text = html.unescape(item['question'])
            correct_answer = html.unescape(item['correct_answer'])
            incorrect_answers = [html.unescape(ans) for ans in item['incorrect_answers']]
            
            # Create Options List
            options = incorrect_answers + [correct_answer]
            random.shuffle(options)
            
            formatted_cards.append({
                "front": question_text,
                "back": correct_answer,
                "options": options
            })
            
        return formatted_cards


# --- GAME LOOP (The System Host) ---
async def run_game_loop(game_id: int):
    """
    Cycles through cards, waits for time limit, then GRADES answers in batch.
    """
    db = SessionLocal()
    try:
        session = db.query(GameSession).get(game_id)
        if not session: return

        # Start Game
        session.status = GameStatus.IN_PROGRESS
        session.current_card_index = 0
        db.commit()

        total_cards = len(session.cards)
        time_limit = session.time_limit_per_card

        for i in range(total_cards):
            # 1. Update Index & Broadcast Card
            db.refresh(session)
            session.current_card_index = i
            db.commit()
            
            current_card = session.cards[i]
            await game_manager.send_next_card(game_id, current_card, time_limit)
            
            # 2. Wait for Time Limit (Players submit answers during this time)
            await asyncio.sleep(time_limit)

            # 3. Time's Up! Batch Grade Everyone
            participants = db.query(GameParticipant).filter_by(session_id=game_id).all()
            correct_answer = current_card["back"]
            
            for p in participants:
                # Check if they answered THIS specific card
                if p.last_answered_card_index == i:
                    if p.last_answer == correct_answer:
                        # Correct
                        points = 100 + (p.streak * 10)
                        p.score += points
                        p.streak += 1
                    else:
                        # Wrong
                        p.streak = 0
                else:
                    # Didn't answer
                    p.streak = 0
            
            db.commit()

            # 4. Broadcast Results (Leaderboard + Correct Answer)
            leaderboard = db.query(GameParticipant).filter_by(session_id=game_id).order_by(GameParticipant.score.desc()).all()
            lb_data = [{"username": p.user.username, "score": p.score, "user_id": str(p.user_id)} for p in leaderboard]
            
            await game_manager.send_round_result(game_id, correct_answer, lb_data)

            # 5. Intermission / Result Screen Delay
            # FIX: Wait after EVERY card, including the last one
            if i < total_cards - 1:
                await asyncio.sleep(5) # Normal intermission
            else:
                await asyncio.sleep(10) # Longer wait for the final question's result
        
        # Finish Game
        session.status = GameStatus.LOBBY
        session.current_card_index = -1
        db.commit()
        
        leaderboard = db.query(GameParticipant).filter_by(session_id=game_id).order_by(GameParticipant.score.desc()).all()
        lb_data = [{"username": p.user.username, "score": p.score, "user_id": str(p.user_id)} for p in leaderboard]
        await game_manager.broadcast(game_id, {"type": "game_over", "leaderboard": lb_data})

    except Exception as e:
        logger.error(f"Error in game loop {game_id}: {e}")
    finally:
        db.close()
        
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
    
    #2. Fetch or Generate Cards based on Mode
    cards = []
    
    # --- MODE 1: TRIVIA (OpenTDB) ---
    if request.mode == "trivia":
        try:
            cards = await fetch_trivia_questions(
                amount=request.num_cards,
                category=request.trivia_category,
                difficulty=request.difficulty,
                user_id=str(current_user.id)
            )
        except Exception as e:
            logger.error(f"Trivia fetch failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to fetch trivia questions. Try a different category.")

    # --- MODE 2: STUDY (LLM + Documents) ---
    uploaded_files = []
    if request.mode != "trivia":
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
                        file_ref = llm_client.upload_file_from_bytes(
                            file_bytes=doc.file_data, mime_type=mime_type, display_name=doc.filename
                        )
                        uploaded_files.append(file_ref)
                    except Exception as e:
                        logger.error(f"Failed to upload doc: {e}")

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

        cards = parse_llm_json(response)
        
    except Exception as e:
        logger.error(f"LLM Generation/Parsing failed: {str(e)}")
        # Log the raw response to help debug if it happens again
        logger.error(f"Raw Response causing error: {locals().get('response', 'No response')}")
        raise HTTPException(status_code=500, detail="Failed to generate valid game content. Please try again.")

    # 4. Create Game Session
    session = GameSession(
        study_group_id=group_id,
        host_id=current_user.id,
        topic=request.topic, # For Trivia, this will be the Category Name passed from frontend or generic
        difficulty=GameDifficulty(request.difficulty.lower()),
        status=GameStatus.LOBBY,
        time_limit_per_card=request.time_limit,
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
    return [{
        "id": g.id, 
        "topic": g.topic, 
        "status": g.status.value, 
        "difficulty": g.difficulty.value,
        "time_limit": g.time_limit_per_card,
        "host_name": g.host.username,
        "host_id": str(g.host_id) #Send UUID also just in case
    } for g in games]


@router.delete("/{game_id}")
def delete_game(
    game_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    game = db.query(GameSession).get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
        
    # Check permissions: Host OR Group Admin
    # We need to check if user is admin of the study group
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == game.study_group_id,
        StudyGroupMembership.user_id == current_user.id
    ).first()
    
    is_host = str(game.host_id) == str(current_user.id)
    is_admin = membership and (membership.role == "admin")
    
    if not (is_host or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to delete this game")
        
    db.delete(game)
    db.commit()
    return {"message": "Game deleted successfully"}


@router.websocket("/{game_id}/ws")
async def game_websocket(websocket: WebSocket, game_id: int, db: Session = Depends(get_db)):
    await websocket.accept()
    token = websocket.query_params.get("token")
    if not token: 
        await websocket.close(code=1008)
        return
    user = get_user_from_token(token, db)
    if not user: 
        await websocket.close(code=1008)
        return

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
            
            if action == "start_game":
                session = db.query(GameSession).get(game_id)
                if str(session.host_id) == str(user.id):
                    asyncio.create_task(run_game_loop(game_id))

            elif action == "answer":
                answer = data.get("value")
                session = db.query(GameSession).get(game_id)

                # Refresh session to get the updates from background thread
                db.refresh(session)
                # Also ensure we are writing to a fresh participant object
                db.refresh(participant)
                
                # Update temporary answer field
                participant.last_answer = answer
                participant.last_answered_card_index = session.current_card_index
                db.commit()

    except WebSocketDisconnect:
        game_manager.disconnect(websocket, game_id)