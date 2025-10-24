export interface ChatMessage {
  id: number;
  group_id: number;
  content: string;
  message_type: 'text' | 'system' | 'ai_response';
  created_at: string;
  user: {
    id: string;
    username: string;
    avatar?: string;
  } | null;
}
