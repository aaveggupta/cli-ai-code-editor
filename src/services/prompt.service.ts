import { getDatabase } from '../database';
import { Prompt, CreatePromptInput } from '../models/Prompt';
import { CodeChange, CreateCodeChangeInput } from '../models/CodeChange';
import { generateId } from '../utils/crypto';

export class PromptService {
  createPrompt(input: CreatePromptInput): Prompt {
    const db = getDatabase();
    const promptId = generateId();

    const stmt = db.prepare(`
      INSERT INTO prompts (id, user_id, prompt, target_repo, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(promptId, input.user_id, input.prompt, input.target_repo, 'pending');

    return {
      id: promptId,
      user_id: input.user_id,
      prompt: input.prompt,
      target_repo: input.target_repo,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
  }

  updatePromptStatus(promptId: string, status: Prompt['status']): void {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE prompts SET status = ? WHERE id = ?');
    stmt.run(status, promptId);
  }

  getPromptById(promptId: string): Prompt | null {
    const db = getDatabase();
    const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(promptId) as Prompt | undefined;
    return prompt || null;
  }

  getPromptsByUserId(userId: string): Prompt[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM prompts WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Prompt[];
  }

  createCodeChange(input: CreateCodeChangeInput): CodeChange {
    const db = getDatabase();
    const changeId = generateId();

    const stmt = db.prepare(`
      INSERT INTO code_changes (id, prompt_id, file_path, original_content, modified_content, change_description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      changeId,
      input.prompt_id,
      input.file_path,
      input.original_content || null,
      input.modified_content || null,
      input.change_description || null
    );

    return {
      id: changeId,
      prompt_id: input.prompt_id,
      file_path: input.file_path,
      original_content: input.original_content || null,
      modified_content: input.modified_content || null,
      change_description: input.change_description || null,
      applied: false,
      created_at: new Date().toISOString(),
    };
  }

  markChangeAsApplied(changeId: string): void {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE code_changes SET applied = TRUE WHERE id = ?');
    stmt.run(changeId);
  }

  getChangesByPromptId(promptId: string): CodeChange[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM code_changes WHERE prompt_id = ? ORDER BY created_at').all(promptId) as CodeChange[];
  }
}

export const promptService = new PromptService();
