from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Set, Any
import json
import logging
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

class VoiceRoom:
    def __init__(self):
        # Users currently viewing the page (connected to WS)
        # {user_id: WebSocket}
        self.subscribers: Dict[str, WebSocket] = {}
        
        # Users actually IN the voice chat
        # {user_id: {'username': str, 'joined_at': float}}
        self.voice_participants: Dict[str, dict] = {}

    async def broadcast(self, message: dict, exclude_user: str = None):
        """Send a message to ALL subscribers (viewers + participants)"""
        msg_json = json.dumps(message)
        to_remove = []
        
        for user_id, ws in self.subscribers.items():
            if user_id == exclude_user:
                continue
            try:
                await ws.send_text(msg_json)
            except Exception:
                to_remove.append(user_id)
        
        for uid in to_remove:
            self.disconnect_user(uid)

    def add_subscriber(self, user_id: str, websocket: WebSocket):
        self.subscribers[user_id] = websocket

    def add_voice_participant(self, user_id: str, info: dict):
        self.voice_participants[user_id] = info

    def remove_voice_participant(self, user_id: str):
        if user_id in self.voice_participants:
            del self.voice_participants[user_id]

    def disconnect_user(self, user_id: str):
        if user_id in self.subscribers:
            del self.subscribers[user_id]
        if user_id in self.voice_participants:
            del self.voice_participants[user_id]

    def get_participant_list(self) -> List[dict]:
        return [
            {"userId": uid, **info}
            for uid, info in self.voice_participants.items()
        ]

# Global manager: {group_id: VoiceRoom}
rooms: Dict[str, VoiceRoom] = {}

def get_room(group_id: str) -> VoiceRoom:
    if group_id not in rooms:
        rooms[group_id] = VoiceRoom()
    return rooms[group_id]

@router.websocket("/ws/{group_id}/{user_id}")
async def voice_endpoint(websocket: WebSocket, group_id: str, user_id: str, username: str = "User"):
    await websocket.accept()
    
    room = get_room(group_id)
    room.add_subscriber(user_id, websocket)
    
    # 1. Immediately send current voice participants to the new subscriber
    # This satisfies Requirement #1 (Seeing users without joining)
    await websocket.send_text(json.dumps({
        "type": "room_state",
        "users": room.get_participant_list()
    }))

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get('type')

            if msg_type == 'ping':
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            # --- VOICE STATUS COMMANDS ---
            if msg_type == 'join_voice':
                # User is officially entering the voice channel
                room.add_voice_participant(user_id, {'username': username})
                
                # Broadcast new state to EVERYONE (updates UI for all)
                await room.broadcast({
                    "type": "room_state",
                    "users": room.get_participant_list()
                })
                
                # Tell the joiner who else is there so they can initiate WebRTC
                # (We filter out the user themselves)
                others = [
                    u for u in room.get_participant_list() 
                    if u['userId'] != user_id
                ]
                await websocket.send_text(json.dumps({
                    "type": "you_joined",
                    "peers": others
                }))

            elif msg_type == 'leave_voice':
                # User explicitly clicked "Leave" but stays on the page
                room.remove_voice_participant(user_id)
                
                # Broadcast update
                await room.broadcast({
                    "type": "room_state",
                    "users": room.get_participant_list()
                })
                
                # Also explicitly tell others to kill the WebRTC connection for this peer
                await room.broadcast({
                    "type": "peer_left",
                    "userId": user_id
                }, exclude_user=user_id)

            # --- WEBRTC SIGNALING ---
            elif msg_type in ('offer', 'answer', 'ice-candidate'):
                target_id = message.get('targetUserId')
                if target_id and target_id in room.subscribers:
                    target_ws = room.subscribers[target_id]
                    try:
                        await target_ws.send_text(json.dumps(message))
                    except Exception:
                        logger.error(f"Failed to signal {target_id}")

    except WebSocketDisconnect:
        # Handle unexpected socket drop (tab close)
        was_in_voice = user_id in room.voice_participants
        room.disconnect_user(user_id)
        
        if was_in_voice:
            # If they were speaking, tell everyone they are gone
            await room.broadcast({
                "type": "room_state",
                "users": room.get_participant_list()
            })
            await room.broadcast({
                "type": "peer_left",
                "userId": user_id
            })
            
    except Exception as e:
        logger.error(f"Error in voice socket: {e}")
        room.disconnect_user(user_id)