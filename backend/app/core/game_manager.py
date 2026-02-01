import json
import asyncio
from typing import Dict, List, Any
from fastapi import WebSocket


# Manages active game sessions and WebSocket connections
# Similar to websocket_manager but tailored for game logic
class GameManager:
    def __init__(self):
        # { game_id: [ { "ws": WebSocket, "user_id": str, "username": str } ] }
        self.active_games: Dict[int, List[Dict[str, Any]]] = {}
        
    async def connect(self, websocket: WebSocket, game_id: int, user_id: str, username: str):
        await websocket.accept()
        if game_id not in self.active_games:
            self.active_games[game_id] = []
        self.active_games[game_id].append({"ws": websocket, "user_id": str(user_id), "username": username})
        
        # Broadcast updated player list
        await self.broadcast_player_list(game_id)

    def disconnect(self, websocket: WebSocket, game_id: int):
        if game_id in self.active_games:
            self.active_games[game_id] = [c for c in self.active_games[game_id] if c["ws"] != websocket]
            if not self.active_games[game_id]:
                del self.active_games[game_id]
            else:
                # Notify others
                asyncio.create_task(self.broadcast_player_list(game_id))

    async def broadcast_player_list(self, game_id: int):
        players = [{"username": c["username"], "user_id": c["user_id"]} for c in self.active_games.get(game_id, [])]
        await self.broadcast(game_id, {"type": "player_update", "players": players})

    async def broadcast(self, game_id: int, message: dict):
        if game_id not in self.active_games:
            return
        
        payload = json.dumps(message)
        for connection in self.active_games[game_id]:
            try:
                await connection["ws"].send_text(payload)
            except Exception:
                pass

    async def send_next_card(self, game_id: int, card: dict, time_limit: int = 15):
        """Broadcasts the next card to all players"""
        await self.broadcast(game_id, {
            "type": "new_card",
            "card": {
                "front": card["front"],
                "options": card["options"] # Don't send the correct answer ('back') yet!
            },
            "time_limit": time_limit
        })

    async def send_round_result(self, game_id: int, correct_answer: str, leaderboard: list):
        await self.broadcast(game_id, {
            "type": "round_end",
            "correct_answer": correct_answer,
            "leaderboard": leaderboard
        })

game_manager = GameManager()