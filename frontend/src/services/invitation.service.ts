import axios from 'axios';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api/v1';

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

export interface Invitation {
  id: number;
  invitee_email: string;
  is_accepted: boolean;
  expires_at: string;
  created_at: string;
}

export const invitationService = {
  sendInvitation: async (groupId: number, email: string) => {
    const { data } = await api.post(`/invitations/${groupId}`, { email });
    return data;
  },

  getGroupInvitations: async (groupId: number): Promise<Invitation[]> => {
    const { data } = await api.get(`/invitations/${groupId}`);
    return data;
  },

  acceptInvitation: async (token: string) => {
    const { data } = await api.post(`/invitations/accept/${token}`);
    return data;
  },

  cancelInvitation: async (invitationId: number) => {
    const { data } = await api.delete(`/invitations/${invitationId}`);
    return data;
  },
};
