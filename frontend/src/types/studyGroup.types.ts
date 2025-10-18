export interface StudyGroup {
  id: number;
  name: string;
  description: string | null;
  subject: string | null;
  max_members: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  creator_id: number;
  member_count: number;
  is_member?: boolean;
  is_admin?: boolean;
}

export interface CreateStudyGroupRequest {
  name: string;
  description?: string;
  subject?: string;
  max_members: number;
}

export interface UpdateStudyGroupRequest {
  name?: string;
  description?: string;
  subject?: string;
  max_members?: number;
}

export interface StudyGroupListResponse {
  groups: StudyGroup[];
  total: number;
  page: number;
  size: number;
}

export interface StudyGroupStats {
  total_groups: number;
  groups_created: number;
  sessions_completed: number;
}
