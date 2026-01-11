from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Any
import json

router = APIRouter(prefix="/voice", tags=["voice"])

class ConnectionManager:
    def __init__(self):
        # Store connections with metadata
        # Structure: {group_id: {user_id: {'socket': WebSocket, 'username': str}}}
        self.active_connections: Dict[str, Dict[str, Dict[str, Any]]] = {}

    async def connect(self, websocket: WebSocket, group_id: str, user_id: str, username: str):
        await websocket.accept()
        if group_id not in self.active_connections:
            self.active_connections[group_id] = {}
        # Store socket AND username
        self.active_connections[group_id][user_id] = {
            'socket': websocket,
            'username': username
        }

    def disconnect(self, group_id: str, user_id: str):
        if group_id in self.active_connections:
            if user_id in self.active_connections[group_id]:
                del self.active_connections[group_id][user_id]
            if not self.active_connections[group_id]:
                del self.active_connections[group_id]

    async def broadcast_to_others(self, message: dict, group_id: str, sender_id: str):
        if group_id in self.active_connections:
            for user_id, user_data in self.active_connections[group_id].items():
                if user_id != sender_id:
                    await user_data['socket'].send_text(json.dumps(message))
    
    # Return objects with ID and Name instead of just ID strings
    def get_active_users(self, group_id: str) -> List[Dict[str, str]]:
        if group_id in self.active_connections:
            return [
                {"userId": uid, "username": data['username']} 
                for uid, data in self.active_connections[group_id].items()
            ]
        return []

manager = ConnectionManager()

@router.get("/groups/{group_id}/users")
async def get_voice_users(group_id: str):
    """Get list of users currently in the voice channel"""
    return {"users": manager.get_active_users(group_id)}

# Updated to accept username query param
@router.websocket("/ws/{group_id}/{user_id}")
async def voice_chat_endpoint(websocket: WebSocket, group_id: str, user_id: str, username: str = "User"):
    await manager.connect(websocket, group_id, user_id, username)
    try:
        # 1. Send existing users (names included) to the NEW person
        current_users = manager.get_active_users(group_id)
        # Filter out self
        others = [u for u in current_users if u['userId'] != user_id]
        
        await websocket.send_text(json.dumps({
            "type": "existing-users", 
            "users": others
        }))

        # 2. Notify OTHERS that a new user joined (include name)
        await manager.broadcast_to_others(
            {
                "type": "user-joined", 
                "userId": user_id, 
                "username": username
            }, 
            group_id, 
            user_id
        )
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            # Forward signaling data
            await manager.broadcast_to_others(message, group_id, user_id)
            
    except WebSocketDisconnect:
        manager.disconnect(group_id, user_id)
        await manager.broadcast_to_others(
            {"type": "user-left", "userId": user_id}, 
            group_id, 
            user_id
        )