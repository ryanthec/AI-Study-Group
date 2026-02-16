import axios from 'axios';
import type { ChatMessage, MissedCountResponse, SummaryResponse } from '../types/message.types';

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
  getMessages: async (groupId: number, limit = 100, offset = 0, mode: 'public' | 'private' = 'public'): Promise<ChatMessage[]> => {
    const { data } = await api.get(`/chat/${groupId}/messages`, {
      params: { limit, offset, mode },
    });
    return data;
  },

  // Create WebSocket connection
  connectWebSocket: (groupId: number): WebSocket => {
    const token = localStorage.getItem('access_token') || '';
    const url = `${WS_HOST}/api/v1/chat/ws/${groupId}?token=${encodeURIComponent(token)}`;
    console.log('Here is my WS_HOST:', WS_HOST);
    console.log('WS URL:', url);
    return new WebSocket(url);
  },

  // Extract context from file (for private tutor)
  extractContext: async (file: File): Promise<{ filename: string; content: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/chat/extract_context', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Send message via WebSocket
  sendMessage: (ws: WebSocket, content: string, mode: 'public' | 'private' = 'public', 
    quizAttemptId?: number, temporaryContext?: Array<{ title: string; content: string }>) => {
    ws.send(JSON.stringify({ content, mode, quiz_attempt_id: quizAttemptId, temporary_context: temporaryContext }));
  },

  // Get missed message count
  async getMissedCount(groupId: number): Promise<MissedCountResponse> {
        const response = await api.get<MissedCountResponse>(`/chat/groups/${groupId}/missed_count`);
        return response.data;
  },

  // Update user last viewed timestamp
  async updateLastViewed(groupId: number): Promise<void> {
      await api.post(`/chat/groups/${groupId}/update_viewed`);
  },

  // Summarise missed messages (calls summarising agent)
  async summariseMissed(groupId: number): Promise<SummaryResponse> {
      const response = await api.post<SummaryResponse>(`/chat/groups/${groupId}/summarise_missed`);
      return response.data;
  },

};
