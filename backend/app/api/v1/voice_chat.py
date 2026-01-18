from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Any
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

class ConnectionManager:
    def __init__(self):
        # Structure: {group_id: {user_id: {'socket': WebSocket, 'username': str}}}
        self.active_connections: Dict[str, Dict[str, Dict[str, Any]]] = {}

    async def connect(self, websocket: WebSocket, group_id: str, user_id: str, username: str):
        await websocket.accept()
        if group_id not in self.active_connections:
            self.active_connections[group_id] = {}
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

    async def send_to_user(self, message: dict, group_id: str, target_user_id: str) -> bool:
        """Send a message to a specific user. Returns True if successful."""
        if group_id in self.active_connections:
            if target_user_id in self.active_connections[group_id]:
                try:
                    await self.active_connections[group_id][target_user_id]['socket'].send_text(
                        json.dumps(message)
                    )
                    return True
                except Exception as e:
                    logger.warning(f"Failed to send to user {target_user_id}: {e}")
                    return False
        return False

    async def broadcast_to_others(self, message: dict, group_id: str, sender_id: str):
        if group_id not in self.active_connections:
            return
        
        disconnected = []
        for user_id, user_data in self.active_connections[group_id].items():
            if user_id != sender_id:
                try:
                    await user_data['socket'].send_text(json.dumps(message))
                except Exception as e:
                    logger.warning(f"Failed to send to {user_id}, marking for disconnect: {e}")
                    disconnected.append(user_id)
        
        # Clean up failed connections
        for user_id in disconnected:
            self.disconnect(group_id, user_id)

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

@router.websocket("/ws/{group_id}/{user_id}")
async def voice_chat_endpoint(websocket: WebSocket, group_id: str, user_id: str, username: str = "User"):
    await manager.connect(websocket, group_id, user_id, username)
    try:
        client_ready = False
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get('type')
            
            # Handle ping (keep-alive)
            if msg_type == 'ping':
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "userId": user_id
                }))
                continue
            
            # Handle client ready signal
            if msg_type == 'client_ready' and not client_ready:
                client_ready = True
                
                # Send existing users to the new person
                current_users = manager.get_active_users(group_id)
                others = [u for u in current_users if u['userId'] != user_id]
                
                await websocket.send_text(json.dumps({
                    "type": "existing-users", 
                    "users": others
                }))

                # Notify others that a new user joined
                await manager.broadcast_to_others(
                    {
                        "type": "user-joined", 
                        "userId": user_id, 
                        "username": username
                    }, 
                    group_id, 
                    user_id
                )
                continue
            
            # Route signaling messages to specific target
            target_user_id = message.get('targetUserId')
            if target_user_id and msg_type in ('offer', 'answer', 'ice-candidate'):
                await manager.send_to_user(message, group_id, target_user_id)
            else:
                # Fallback: broadcast to others
                await manager.broadcast_to_others(message, group_id, user_id)
            
    except WebSocketDisconnect:
        manager.disconnect(group_id, user_id)
        await manager.broadcast_to_others(
            {"type": "user-left", "userId": user_id}, 
            group_id, 
            user_id
        )
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(group_id, user_id)
        await manager.broadcast_to_others(
            {"type": "user-left", "userId": user_id}, 
            group_id, 
            user_id
        )