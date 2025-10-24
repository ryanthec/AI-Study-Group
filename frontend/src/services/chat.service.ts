import axios from 'axios';
import type { ChatMessage } from '../types/message.types';

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

export const chatService = {
  // Get message history
  getMessages: async (groupId: number, limit = 100, offset = 0): Promise<ChatMessage[]> => {
    const { data } = await api.get(`/chat/${groupId}/messages`, {
      params: { limit, offset },
    });
    return data;
  },

  // Create WebSocket connection
  connectWebSocket: (groupId: number): WebSocket => {
    const token = localStorage.getItem('access_token') || '';
    const url = `ws://localhost:8000/api/v1/chat/ws/${groupId}?token=${encodeURIComponent(token)}`;
    console.log('WS URL:', url);
    return new WebSocket(url);
  },

  // Send message via WebSocket
  sendMessage: (ws: WebSocket, content: string) => {
    ws.send(JSON.stringify({ content }));
  },
};
