export interface Prompt {
  id: string;
  user_id: string;
  prompt: string;
  target_repo: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

export interface CreatePromptInput {
  user_id: string;
  prompt: string;
  target_repo: string;
}
