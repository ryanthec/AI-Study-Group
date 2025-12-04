import axios from 'axios';

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface AgentConfig {
  rag_mode: string;
  rag_enabled: boolean;
  socratic_prompting: boolean;
  socratic_limits: {
    factual: number;
    conceptual: number;
    applied: number;
    complex: number;
  };
  temperature: number;
  max_tokens: number;
}

interface UpdateSocraticLimitsRequest {
  factual?: number;
  conceptual?: number;
  applied?: number;
  complex?: number;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');

  // Debug logs
  console.log('[Agent Config] Token from localStorage:', token);
  console.log('[Agent Config] Token length:', token?.length);
  console.log('[Agent Config] Token segments:', token?.split('.').length);
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const agentConfigService = {
  // Get agent configuration for a group
  async getAgentConfig(groupId: number): Promise<AgentConfig> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/agent-config/${groupId}`,
        {
          headers: getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch agent config:', error);
      throw error;
    }
  },

  // Update RAG mode
  async updateRagMode(groupId: number, ragMode: string): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/agent-config/${groupId}/rag-mode`,
        null,
        {
          params: { rag_mode: ragMode },
          headers: getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to update RAG mode:', error);
      throw error;
    }
  },

  // Update Socratic mode
  async updateSocraticMode(groupId: number, enabled: boolean): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/agent-config/${groupId}/socratic-mode`,
        null,
        {
          params: { enabled },
          headers: getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to update socratic mode:', error);
      throw error;
    }
  },

  // Update Socratic prompt limits
  async updateSocraticLimits(
    groupId: number,
    limits: UpdateSocraticLimitsRequest
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/agent-config/${groupId}/socratic-limits`,
        null,
        {
          params: limits,
          headers: getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to update socratic limits:', error);
      throw error;
    }
  },

  // Update temperature
  async updateTemperature(groupId: number, temperature: number): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/agent-config/${groupId}/temperature`,
        null,
        {
          params: { temperature },
          headers: getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to update temperature:', error);
      throw error;
    }
  },
};