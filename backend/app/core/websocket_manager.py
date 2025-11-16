from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
    
    async def register(self, websocket: WebSocket, group_id: int):
        # websocket already accepted by the endpoint
        self.active_connections.setdefault(group_id, []).append(websocket)
        # Broadcast updated count after adding connection
        await self.broadcast_user_count(group_id)
    
    def disconnect(self, websocket: WebSocket, group_id: int):
        conns = self.active_connections.get(group_id)
        if not conns:
            return
        try:
            conns.remove(websocket)
        except ValueError:
            return
        if not conns:
            del self.active_connections[group_id]
    
    def get_connection_count(self, group_id: int) -> int:
        """Get the number of active WebSocket connections for a group"""
        return len(self.active_connections.get(group_id, []))
    
    async def broadcast_user_count(self, group_id: int):
        """Broadcast the current user count to all connected clients"""
        count = self.get_connection_count(group_id)
        await self.broadcast_to_group({
            "type": "user_count_update",
            "count": count
        }, group_id)
    
    async def broadcast_to_group(self, message: dict, group_id: int):
        for ws in list(self.active_connections.get(group_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws, group_id)

# export a singleton
manager = ConnectionManager()