#!/usr/bin/env node

import { Command } from 'commander';
import prompts from 'prompts';
import { initDatabase } from '../database';
import { authService } from '../services/auth.service';
import { executorService } from '../services/executor.service';
import { promptService } from '../services/prompt.service';
import { Logger } from '../utils/logger';
import { config } from '../config';
import path from 'path';
import { promises as fs } from 'fs';

const program = new Command();

// Store credentials in-memory for CLI session
let currentUser: { id: string; username: string; apiKey: string } | null = null;

const CONFIG_FILE = path.join(process.env.HOME || '', '.cli-editor.json');

async function loadCredentials(): Promise<void> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const creds = JSON.parse(data);
    currentUser = creds;
    Logger.success(`Logged in as ${currentUser?.username}`);
  } catch {
    // No credentials saved
  }
}

async function saveCredentials(user: { id: string; username: string; apiKey: string }): Promise<void> {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(user, null, 2));
}

async function clearCredentials(): Promise<void> {
  try {
    await fs.unlink(CONFIG_FILE);
  } catch {
    // File doesn't exist
  }
}

program
  .name('cli-editor')
  .description('AI-powered code generation and modification CLI')
  .version('1.0.0');

// Register command
program
  .command('register')
  .description('Register a new user account')
  .action(async () => {
    initDatabase();

    const response = await prompts([
      {
        type: 'text',
        name: 'username',
        message: 'Username:',
        validate: (value) => (value.length >= 3 ? true : 'Username must be at least 3 characters'),
      },
      {
        type: 'text',
        name: 'email',
        message: 'Email:',
        validate: (value) => (value.includes('@') ? true : 'Please enter a valid email'),
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        validate: (value) => (value.length >= 6 ? true : 'Password must be at least 6 characters'),
      },
    ]);

    if (!response.username || !response.email || !response.password) {
      Logger.error('Registration cancelled');
      return;
    }

    try {
      const user = await authService.register(response);
      currentUser = {
        id: user.id,
        username: user.username,
        apiKey: user.api_key,
      };

      await saveCredentials(currentUser);

      Logger.success('Registration successful!');
      Logger.info(`Username: ${user.username}`);
      Logger.info(`API Key: ${user.api_key}`);
      Logger.info('Your API key has been saved. Keep it secure!');
    } catch (error: any) {
      Logger.error(`Registration failed: ${error.message}`);
    }
  });

// Login command
program
  .command('login')
  .description('Login to your account')
  .action(async () => {
    initDatabase();

    const response = await prompts([
      {
        type: 'text',
        name: 'username',
        message: 'Username:',
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
      },
    ]);

    if (!response.username || !response.password) {
      Logger.error('Login cancelled');
      return;
    }

    try {
      const result = await authService.login(response.username, response.password);
      currentUser = {
        id: result.user.id,
        username: result.user.username,
        apiKey: result.user.api_key,
      };

      await saveCredentials(currentUser);

      Logger.success('Login successful!');
      Logger.info(`Logged in as ${result.user.username}`);
      Logger.info(`API Key: ${result.user.api_key}`);
    } catch (error: any) {
      Logger.error(`Login failed: ${error.message}`);
    }
  });

// Logout command
program
  .command('logout')
  .description('Logout from your account')
  .action(async () => {
    await clearCredentials();
    currentUser = null;
    Logger.success('Logged out successfully');
  });

// Execute command - main functionality
program
  .command('run')
  .description('Execute a natural language prompt to modify code')
  .option('-r, --repo <path>', 'Target repository path', config.cli.defaultTargetRepo)
  .option('-p, --prompt <text>', 'Prompt text (interactive if not provided)')
  .action(async (options) => {
    initDatabase();
    await loadCredentials();

    if (!currentUser) {
      Logger.error('You must be logged in to execute prompts. Use "cli-editor login" or "cli-editor register"');
      return;
    }

    let promptText = options.prompt;

    if (!promptText) {
      const response = await prompts({
        type: 'text',
        name: 'prompt',
        message: 'Enter your prompt:',
        validate: (value) => (value.length > 0 ? true : 'Prompt cannot be empty'),
      });

      if (!response.prompt) {
        Logger.error('Execution cancelled');
        return;
      }

      promptText = response.prompt;
    }

    const targetRepo = path.resolve(options.repo);

    Logger.section('CLI EDITOR AI CODE MODIFICATION');
    Logger.info(`Target Repository: ${targetRepo}`);
    Logger.info(`Prompt: ${promptText}`);
    Logger.info('');

    try {
      const result = await executorService.executePrompt(currentUser.id, promptText, targetRepo);

      if (result.success) {
        Logger.success('\nExecution completed successfully!');
        Logger.info(`Prompt ID: ${result.promptId}`);
      } else {
        Logger.error('\nExecution completed with errors.');
        Logger.info(`Prompt ID: ${result.promptId}`);
      }
    } catch (error: any) {
      Logger.error(`Execution failed: ${error.message}`);
    }
  });

// History command
program
  .command('history')
  .description('View your prompt execution history')
  .option('-l, --limit <number>', 'Limit number of results', '10')
  .action(async (options) => {
    initDatabase();
    await loadCredentials();

    if (!currentUser) {
      Logger.error('You must be logged in. Use "cli-editor login" or "cli-editor register"');
      return;
    }

    try {
      const prompts = promptService.getPromptsByUserId(currentUser.id);
      const limit = parseInt(options.limit, 10);
      const limited = prompts.slice(0, limit);

      Logger.section('PROMPT HISTORY');

      if (limited.length === 0) {
        Logger.info('No prompts found');
        return;
      }

      limited.forEach((p, index) => {
        Logger.info(`\n[${index + 1}] ${p.id}`);
        Logger.info(`  Status: ${p.status}`);
        Logger.info(`  Prompt: ${p.prompt.substring(0, 100)}${p.prompt.length > 100 ? '...' : ''}`);
        Logger.info(`  Repo: ${p.target_repo}`);
        Logger.info(`  Date: ${p.created_at}`);
      });

      if (prompts.length > limit) {
        Logger.info(`\n... and ${prompts.length - limit} more`);
      }
    } catch (error: any) {
      Logger.error(`Failed to fetch history: ${error.message}`);
    }
  });

// Details command
program
  .command('details <promptId>')
  .description('View detailed information about a specific prompt execution')
  .action(async (promptId) => {
    initDatabase();
    await loadCredentials();

    if (!currentUser) {
      Logger.error('You must be logged in. Use "cli-editor login" or "cli-editor register"');
      return;
    }

    try {
      const prompt = promptService.getPromptById(promptId);

      if (!prompt) {
        Logger.error('Prompt not found');
        return;
      }

      if (prompt.user_id !== currentUser.id) {
        Logger.error('Access denied - this prompt belongs to another user');
        return;
      }

      const changes = promptService.getChangesByPromptId(promptId);

      Logger.section('PROMPT DETAILS');
      Logger.info(`ID: ${prompt.id}`);
      Logger.info(`Status: ${prompt.status}`);
      Logger.info(`Prompt: ${prompt.prompt}`);
      Logger.info(`Repository: ${prompt.target_repo}`);
      Logger.info(`Created: ${prompt.created_at}`);

      Logger.section('CODE CHANGES');
      Logger.info(`Total changes: ${changes.length}`);

      changes.forEach((change, index) => {
        Logger.info(`\n[${index + 1}] ${change.file_path}`);
        Logger.info(`  Description: ${change.change_description || 'N/A'}`);
        Logger.info(`  Applied: ${change.applied ? 'Yes' : 'No'}`);
      });
    } catch (error: any) {
      Logger.error(`Failed to fetch details: ${error.message}`);
    }
  });

// Whoami command
program
  .command('whoami')
  .description('Display current user information')
  .action(async () => {
    await loadCredentials();

    if (!currentUser) {
      Logger.info('Not logged in');
      return;
    }

    Logger.section('CURRENT USER');
    Logger.info(`Username: ${currentUser.username}`);
    Logger.info(`User ID: ${currentUser.id}`);
    Logger.info(`API Key: ${currentUser.apiKey}`);
  });

program.parse();
