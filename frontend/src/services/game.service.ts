import axios from 'axios';

// --- Types ---

export interface GameSession {
  id: number;
  topic: string;
  status: 'lobby' | 'in_progress' | 'finished';
  difficulty: 'easy' | 'medium' | 'hard';
  host_id: string;
}

export interface CreateGameRequest {
  topic: string;
  num_cards?: number;
  document_ids?: number[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface CreateGameResponse {
  game_id: number;
  message?: string;
}

// --- Configuration ---

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api/v1';
const WS_HOST = (import.meta as any).env.VITE_WS_URL || 'ws://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Service ---

export const gameService = {
  
  // Fetch active games for a specific group
  getActiveGames: async (groupId: number): Promise<GameSession[]> => {
    const { data } = await api.get<GameSession[]>(`/games/groups/${groupId}/active`);
    return data;
  },

  // Create a new game lobby
  createGame: async (groupId: number, payload: CreateGameRequest): Promise<CreateGameResponse> => {
    const { data } = await api.post<CreateGameResponse>(`/games/groups/${groupId}/create`, payload);
    return data;
  },

  // Create WebSocket connection for a specific game
  connectWebSocket: (gameId: number): WebSocket => {
    const token = localStorage.getItem('access_token') || '';
    // Construct the URL: WS_HOST + /api/v1/games/{gameId}/ws
    const url = `${WS_HOST}/api/v1/games/${gameId}/ws?token=${encodeURIComponent(token)}`;
    
    console.log('Connecting to Game WS:', url);
    return new WebSocket(url);
  },
};