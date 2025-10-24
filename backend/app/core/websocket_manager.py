# app/core/websocket_manager.py
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def register(self, websocket: WebSocket, group_id: int):
        # websocket already accepted by the endpoint
        self.active_connections.setdefault(group_id, []).append(websocket)

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

    async def broadcast_to_group(self, message: dict, group_id: int):
        for ws in list(self.active_connections.get(group_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws, group_id)

# export a singleton
manager = ConnectionManager()