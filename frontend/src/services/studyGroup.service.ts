import axios from 'axios';
import type {
  StudyGroup,
  CreateStudyGroupRequest,
  UpdateStudyGroupRequest,
  StudyGroupListResponse,
  StudyGroupStats,
} from '../types/studyGroup.types';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const studyGroupService = {
  // Create a new study group
  createGroup: async (data: CreateStudyGroupRequest): Promise<StudyGroup> => {
    const response = await api.post('/study-groups/', data);
    return response.data;
  },

  // Get user's study groups
  getMyGroups: async (page = 1, size = 10): Promise<StudyGroupListResponse> => {
    const response = await api.get('/study-groups/my-groups', {
      params: { page, size },
    });
    return response.data;
  },

  // Search/browse study groups
  searchGroups: async (
    query = '',
    subject = '',
    page = 1,
    size = 10
  ): Promise<StudyGroupListResponse> => {
    const response = await api.get('/study-groups/search', {
      params: { query, subject, page, size },
    });
    return response.data;
  },

  // Get single study group details
  getGroup: async (groupId: number): Promise<StudyGroup> => {
    const response = await api.get(`/study-groups/${groupId}`);
    return response.data;
  },

  // Join a study group
  joinGroup: async (groupId: number): Promise<void> => {
    await api.post(`/study-groups/${groupId}/join`);
  },

  // Leave a study group
  leaveGroup: async (groupId: number): Promise<void> => {
    await api.post(`/study-groups/${groupId}/leave`);
  },

  // Update study group (admin only)
  updateGroup: async (
    groupId: number,
    data: UpdateStudyGroupRequest
  ): Promise<StudyGroup> => {
    const response = await api.put(`/study-groups/${groupId}`, data);
    return response.data;
  },

  // Delete study group (admin only)
  deleteGroup: async (groupId: number): Promise<void> => {
    await api.delete(`/study-groups/${groupId}`);
  },

  // Get dashboard stats
 getStats: async (): Promise<StudyGroupStats> => {
    const { data } = await api.get('/dashboard/stats');
    return data as StudyGroupStats;
  },

  // Increment completed study sessions (for later use)
  incrementSessions: async (): Promise<number> => {
    const { data } = await api.post('/dashboard/sessions/increment');
    return data.sessions_completed as number;
  },
};
