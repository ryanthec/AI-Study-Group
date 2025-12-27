from typing import Dict, List, Any
from fastapi import WebSocket
from ..models.user import User

class ConnectionManager:
    def __init__(self):
        # Store dict of { 'ws': WebSocket, 'user': User }
        self.active_connections: Dict[int, List[Dict[str, Any]]] = {}
    
    async def register(self, websocket: WebSocket, group_id: int, user: User):
        # Add connection with user info
        connection_info = {"ws": websocket, "user": user}
        self.active_connections.setdefault(group_id, []).append(connection_info)
        
        # Broadcast updated list immediately
        await self.broadcast_online_users(group_id)
    
    def disconnect(self, websocket: WebSocket, group_id: int):
        conns = self.active_connections.get(group_id)
        if not conns:
            return
            
        # Remove the specific connection entry
        self.active_connections[group_id] = [c for c in conns if c['ws'] != websocket]
        
        if not self.active_connections[group_id]:
            del self.active_connections[group_id]
    
    async def broadcast_online_users(self, group_id: int):
        """Broadcast the list of unique online users to the group"""
        conns = self.active_connections.get(group_id, [])
        
        # Get unique users (handle multiple tabs per user)
        unique_users = {}
        for c in conns:
            user = c['user']
            if user.id not in unique_users:
                unique_users[user.id] = {
                    "id": str(user.id),
                    "username": user.username,
                    "firstName": user.first_name,
                    "lastName": user.last_name,
                    "avatar": user.avatar
                }
        
        user_list = list(unique_users.values())
        
        await self.broadcast_to_group({
            "type": "online_users_update",
            "count": len(user_list),
            "users": user_list
        }, group_id)
    
    async def broadcast_to_group(self, message: dict, group_id: int):
        # Iterate over copy of list to be safe
        for c in list(self.active_connections.get(group_id, [])):
            ws = c['ws']
            try:
                await ws.send_json(message)
            except Exception:
                # If send fails, assume disconnected
                self.disconnect(ws, group_id)

manager = ConnectionManager()