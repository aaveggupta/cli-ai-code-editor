export interface CodeChange {
  id: string;
  prompt_id: string;
  file_path: string;
  original_content: string | null;
  modified_content: string | null;
  change_description: string | null;
  applied: boolean;
  created_at: string;
}

export interface CreateCodeChangeInput {
  prompt_id: string;
  file_path: string;
  original_content?: string;
  modified_content?: string;
  change_description?: string;
}
