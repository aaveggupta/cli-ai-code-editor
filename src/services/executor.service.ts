import { codebaseService } from './codebase.service';
import { llmService, CodeModification } from './llm.service';
import { promptService } from './prompt.service';
import { Logger } from '../utils/logger';
import ora from 'ora';
import * as path from 'path';

export interface ExecutionResult {
  success: boolean;
  promptId: string;
  plan: string;
  modifications: CodeModification[];
  appliedChanges: number;
  errors: string[];
}

export class ExecutorService {
  async executePrompt(
    userId: string,
    promptText: string,
    targetRepo: string
  ): Promise<ExecutionResult> {
    const errors: string[] = [];
    let spinner = ora();

    try {
      // Step 1: Create prompt record
      Logger.section('INITIALIZING PROMPT EXECUTION');
      const prompt = promptService.createPrompt({
        user_id: userId,
        prompt: promptText,
        target_repo: targetRepo,
      });

      Logger.info(`Prompt ID: ${prompt.id}`);
      promptService.updatePromptStatus(prompt.id, 'processing');

      // Step 2: Analyze codebase
      Logger.section('ANALYZING CODEBASE');
      spinner = ora('Scanning repository...').start();

      const analysis = await codebaseService.analyzeCodebase(targetRepo);

      spinner.succeed(`Found ${analysis.totalFiles} files (${(analysis.totalSize / 1024).toFixed(2)} KB)`);

      Logger.info('Repository structure:');
      console.log(analysis.structure);

      // Step 3: Extract keywords from prompt for relevance filtering
      spinner = ora('Finding relevant files...').start();
      const keywords = this.extractKeywords(promptText);
      const relevantFiles = await codebaseService.findRelevantFiles(targetRepo, keywords);

      spinner.succeed(`Identified ${relevantFiles.length} potentially relevant files`);

      if (relevantFiles.length > 0) {
        Logger.info('Relevant files:');
        relevantFiles.slice(0, 5).forEach((file) => Logger.info(`  - ${file.relativePath}`));
        if (relevantFiles.length > 5) {
          Logger.info(`  ... and ${relevantFiles.length - 5} more`);
        }
      }

      // Step 4: Generate plan and modifications with LLM
      Logger.section('GENERATING CODE MODIFICATIONS');
      spinner = ora('Consulting LLM...').start();

      const llmResponse = await llmService.analyzeAndGenerateCode(
        promptText,
        relevantFiles.length > 0 ? relevantFiles : analysis.files.slice(0, 5),
        analysis.structure
      );

      spinner.succeed('LLM analysis complete');

      // Step 5: Display plan
      Logger.section('EXECUTION PLAN');
      Logger.info(llmResponse.plan);

      // Step 6: Display proposed modifications
      Logger.section('PROPOSED MODIFICATIONS');
      Logger.info(`Total modifications: ${llmResponse.modifications.length}`);

      llmResponse.modifications.forEach((mod, index) => {
        Logger.step(index + 1, llmResponse.modifications.length,
          `${mod.isNewFile ? 'CREATE' : 'MODIFY'}: ${mod.filePath}`);
        Logger.info(`  Description: ${mod.description}`);
      });

      // Step 7: Save modifications to database
      spinner = ora('Saving modifications to database...').start();

      for (const mod of llmResponse.modifications) {
        promptService.createCodeChange({
          prompt_id: prompt.id,
          file_path: mod.filePath,
          original_content: mod.originalContent || undefined,
          modified_content: mod.modifiedContent,
          change_description: mod.description,
        });
      }

      spinner.succeed('Modifications saved');

      // Step 8: Apply modifications
      Logger.section('APPLYING CHANGES');
      let appliedCount = 0;

      for (let i = 0; i < llmResponse.modifications.length; i++) {
        const mod = llmResponse.modifications[i];
        const fullPath = path.join(targetRepo, mod.filePath);

        spinner = ora(`[${i + 1}/${llmResponse.modifications.length}] ${mod.isNewFile ? 'Creating' : 'Modifying'} ${mod.filePath}...`).start();

        try {
          await codebaseService.writeFile(fullPath, mod.modifiedContent);
          spinner.succeed(`${mod.isNewFile ? 'Created' : 'Modified'} ${mod.filePath}`);
          appliedCount++;

          // Mark as applied in database
          const changes = promptService.getChangesByPromptId(prompt.id);
          const change = changes.find((c) => c.file_path === mod.filePath);
          if (change) {
            promptService.markChangeAsApplied(change.id);
          }
        } catch (error: any) {
          spinner.fail(`Failed to modify ${mod.filePath}: ${error.message}`);
          errors.push(`${mod.filePath}: ${error.message}`);
        }
      }

      // Step 9: Update prompt status
      promptService.updatePromptStatus(prompt.id, errors.length === 0 ? 'completed' : 'failed');

      // Step 10: Summary
      Logger.section('EXECUTION SUMMARY');
      Logger.success(`Successfully applied ${appliedCount} out of ${llmResponse.modifications.length} modifications`);

      if (errors.length > 0) {
        Logger.error(`Encountered ${errors.length} errors:`);
        errors.forEach((err) => Logger.error(`  - ${err}`));
      }

      return {
        success: errors.length === 0,
        promptId: prompt.id,
        plan: llmResponse.plan,
        modifications: llmResponse.modifications,
        appliedChanges: appliedCount,
        errors,
      };
    } catch (error: any) {
      Logger.error('Execution failed:', error.message);
      errors.push(error.message);

      return {
        success: false,
        promptId: '',
        plan: '',
        modifications: [],
        appliedChanges: 0,
        errors,
      };
    }
  }

  private extractKeywords(prompt: string): string[] {
    // Simple keyword extraction - in production, this could use NLP
    const words = prompt
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter((word) => !['this', 'that', 'with', 'from', 'have', 'will', 'would', 'could', 'should'].includes(word));

    return [...new Set(words)];
  }
}

export const executorService = new ExecutorService();
