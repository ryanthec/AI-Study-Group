import api from './api';

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string | number; // Index or string value
  explanation?: string;
}

export interface Quiz {
  id: number;
  title: string;
  description: string;
  study_group_id: number;
  questions: QuizQuestion[]; // JSON structure
  num_questions: number;
  scope: 'group' | 'personal';
  created_at: string;
  creator_name: string;
  latest_attempt?: QuizAttemptSummary;
}

export interface CreateQuizRequest {
  title: string;
  description?: string;
  document_ids: number[];
  topic_prompt: string;
  num_questions: number;
  scope: 'group' | 'personal';
}

export interface QuizAttemptSummary {
    score: number;
    total_questions: number;
    passed: boolean;
    completed_at: string;
}

export interface QuizAttemptResult {
    attempt_id: number;
    score: number;
    total_questions: number;
    percentage: number;
    passed: boolean;
    completed_at: string;
    answers?: Record<number, string>; // Optional, present when fetching details
}

class QuizService {
  async getGroupQuizzes(groupId: number): Promise<Quiz[]> {
    const response = await api.get<Quiz[]>(`/quizzes/groups/${groupId}/list`);
    return response.data;
  }

  async createQuiz(groupId: number, data: CreateQuizRequest): Promise<Quiz> {
    const response = await api.post<Quiz>(`/quizzes/groups/${groupId}/create`, data);
    return response.data;
  }

  async deleteQuiz(groupId: number, quizId: number): Promise<void> {
    await api.delete(`/quizzes/groups/${groupId}/delete/${quizId}`);
  }
  
  async submitAttempt( groupId: number,  quizId: number, answers: Record<number, string>): Promise<QuizAttemptResult>{
    const response = await api.post<QuizAttemptResult>(
        `/quizzes/groups/${groupId}/submit_attempt/${quizId}`, 
        { answers }
    );
    return response.data;
  }

  async getLatestAttempt(groupId: number, quizId: number): Promise<QuizAttemptResult> {
    const response = await api.get<QuizAttemptResult>(
        `/quizzes/groups/${groupId}/latest_attempt/${quizId}`
    );
    return response.data;
  }

}

export const quizService = new QuizService();