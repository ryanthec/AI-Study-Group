import type { User } from './auth.types';

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  subject: string;
  ownerId: string;
  members: User[];
  maxMembers: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudyGroupRequest {
  name: string;
  description: string;
  subject: string;
  maxMembers: number;
}

export interface StudyGroupInvite {
  id: string;
  studyGroupId: string;
  studyGroup: StudyGroup;
  invitedBy: User;
  invitedUser: User;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  studyGroupId: string;
  userId: string;
  user: User;
  content: string;
  messageType: 'user' | 'ai' | 'system';
  isAiMention: boolean;
  createdAt: string;
}