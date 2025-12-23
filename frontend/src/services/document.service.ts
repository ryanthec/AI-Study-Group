import api from './api';

export interface Document {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  created_at: string;
  uploader: {
    id: string;
    username: string;
  };
}

export const documentService = {
  getGroupDocuments: async (groupId: number): Promise<Document[]> => {
    const response = await api.get<Document[]>(`/documents/group/${groupId}`);
    return response.data;
  },

  getDocument: async (groupId: number, documentId: number): Promise<Document> => {
    const response = await api.get<Document>(`/documents/${documentId}/group/${groupId}`);
    return response.data;
  },

  deleteDocument: async (groupId: number, documentId: number): Promise<void> => {
    await api.delete(`/documents/${documentId}/group/${groupId}`);
  }
};