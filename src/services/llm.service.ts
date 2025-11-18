import OpenAI from 'openai';
import { config } from '../config';
import { FileInfo } from './codebase.service';

export interface CodeModification {
  filePath: string;
  originalContent: string | null;
  modifiedContent: string;
  description: string;
  isNewFile: boolean;
}

export interface LLMResponse {
  plan: string;
  modifications: CodeModification[];
}

export class LLMService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async analyzeAndGenerateCode(
    prompt: string,
    codebaseFiles: FileInfo[],
    codebaseStructure: string
  ): Promise<LLMResponse> {
    const systemPrompt = `You are an expert software engineer assistant. Your task is to analyze a codebase and generate or modify code based on user requirements.

When given a task:
1. First, create a clear plan explaining what changes you'll make
2. Identify which files need to be modified or created
3. Generate the complete modified code for each file
4. Provide clear descriptions of each change

Return your response in the following JSON format:
{
  "plan": "Detailed explanation of what you will do",
  "modifications": [
    {
      "filePath": "relative/path/to/file.ts",
      "originalContent": "existing content or null if new file",
      "modifiedContent": "complete new content",
      "description": "what this change does",
      "isNewFile": true/false
    }
  ]
}

IMPORTANT:
- Always provide the COMPLETE file content in modifiedContent, not just the changes
- For new files, set isNewFile to true and originalContent to null
- For existing files, include the original content
- Be precise and ensure the code is production-ready
- Follow best practices and maintain consistency with the existing codebase`;

    const codebaseContext = this.buildCodebaseContext(codebaseFiles, codebaseStructure);

    const userMessage = `${codebaseContext}

User Request: ${prompt}

Please analyze the codebase and provide your response in the specified JSON format.`;

    const completion = await this.client.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '';

    try {
      // Parse JSON response
      const parsed = JSON.parse(responseText);

      return {
        plan: parsed.plan || 'No plan provided',
        modifications: parsed.modifications || [],
      };
    } catch (error) {
      // Fallback: try to extract JSON from markdown code blocks
      try {
        const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || responseText.match(/{[\s\S]*}/);
        const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
        const parsed = JSON.parse(jsonText);

        return {
          plan: parsed.plan || 'No plan provided',
          modifications: parsed.modifications || [],
        };
      } catch (innerError) {
        throw new Error(`Failed to parse LLM response: ${error}`);
      }
    }
  }

  private buildCodebaseContext(files: FileInfo[], structure: string): string {
    let context = '=== CODEBASE STRUCTURE ===\n';
    context += structure + '\n\n';

    context += '=== RELEVANT FILES ===\n\n';

    // Limit to most relevant files to avoid token limits
    const maxFiles = 10;
    const selectedFiles = files.slice(0, maxFiles);

    for (const file of selectedFiles) {
      context += `--- ${file.relativePath} ---\n`;
      context += file.content + '\n\n';
    }

    if (files.length > maxFiles) {
      context += `... and ${files.length - maxFiles} more files\n`;
    }

    return context;
  }

  async chat(message: string, context?: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'user',
          content: context ? `${context}\n\n${message}` : message,
        },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    return completion.choices[0]?.message?.content || '';
  }
}

export const llmService = new LLMService();
