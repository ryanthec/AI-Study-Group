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


// Interfaces for missed messsage count and summary responses for summarising agent
export interface MissedCountResponse {
    missed_count: number;
    last_viewed: string | null;
}

export interface SummaryResponse {
    summary: string;
}
