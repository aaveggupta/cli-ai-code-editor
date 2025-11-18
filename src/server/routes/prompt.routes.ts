import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { executorService } from '../../services/executor.service';
import { promptService } from '../../services/prompt.service';

const router = Router();

// Execute a new prompt
router.post('/execute', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { prompt, targetRepo } = req.body;

    if (!prompt || !targetRepo) {
      res.status(400).json({ error: 'Prompt and targetRepo are required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await executorService.executePrompt(
      req.user.id,
      prompt,
      targetRepo
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's prompt history
router.get('/history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const prompts = promptService.getPromptsByUserId(req.user.id);
    res.json({ prompts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get prompt details and changes
router.get('/:promptId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { promptId } = req.params;

    const prompt = promptService.getPromptById(promptId);

    if (!prompt) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    // Check if the prompt belongs to the user
    if (prompt.user_id !== req.user?.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const changes = promptService.getChangesByPromptId(promptId);

    res.json({ prompt, changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
