import { promises as fs } from 'fs';
import path from 'path';

export interface FileInfo {
  path: string;
  relativePath: string;
  content: string;
  extension: string;
  size: number;
}

export interface CodebaseAnalysis {
  files: FileInfo[];
  structure: string;
  totalFiles: number;
  totalSize: number;
}

export class CodebaseService {
  private ignoredDirs = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    '.cache',
    'tmp',
    'temp',
  ];

  private ignoredFiles = ['.DS_Store', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

  private codeExtensions = [
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.py',
    '.java',
    '.go',
    '.rs',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.css',
    '.scss',
    '.html',
    '.json',
    '.md',
    '.yaml',
    '.yml',
    '.sql',
  ];

  async analyzeCodebase(repoPath: string): Promise<CodebaseAnalysis> {
    const files: FileInfo[] = [];
    let totalSize = 0;

    await this.scanDirectory(repoPath, repoPath, files);

    totalSize = files.reduce((sum, file) => sum + file.size, 0);

    const structure = await this.generateStructure(repoPath);

    return {
      files,
      structure,
      totalFiles: files.length,
      totalSize,
    };
  }

  private async scanDirectory(basePath: string, currentPath: string, files: FileInfo[]): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!this.ignoredDirs.includes(entry.name)) {
          await this.scanDirectory(basePath, fullPath, files);
        }
      } else if (entry.isFile()) {
        if (!this.ignoredFiles.includes(entry.name)) {
          const ext = path.extname(entry.name);
          if (this.codeExtensions.includes(ext)) {
            const content = await fs.readFile(fullPath, 'utf-8');
            const stats = await fs.stat(fullPath);
            const relativePath = path.relative(basePath, fullPath);

            files.push({
              path: fullPath,
              relativePath,
              content,
              extension: ext,
              size: stats.size,
            });
          }
        }
      }
    }
  }

  private async generateStructure(repoPath: string, prefix = ''): Promise<string> {
    let structure = '';
    const entries = await fs.readdir(repoPath, { withFileTypes: true });

    const filteredEntries = entries.filter(
      (entry) =>
        !this.ignoredDirs.includes(entry.name) &&
        !this.ignoredFiles.includes(entry.name)
    );

    for (let i = 0; i < filteredEntries.length; i++) {
      const entry = filteredEntries[i];
      const isLastEntry = i === filteredEntries.length - 1;
      const connector = isLastEntry ? '└── ' : '├── ';

      structure += `${prefix}${connector}${entry.name}\n`;

      if (entry.isDirectory()) {
        const newPrefix = prefix + (isLastEntry ? '    ' : '│   ');
        const fullPath = path.join(repoPath, entry.name);
        structure += await this.generateStructure(fullPath, newPrefix);
      }
    }

    return structure;
  }

  async findRelevantFiles(
    repoPath: string,
    keywords: string[]
  ): Promise<FileInfo[]> {
    const analysis = await this.analyzeCodebase(repoPath);
    const relevantFiles: FileInfo[] = [];

    for (const file of analysis.files) {
      const searchText = (file.relativePath + ' ' + file.content).toLowerCase();

      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          relevantFiles.push(file);
          break;
        }
      }
    }

    return relevantFiles;
  }

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const codebaseService = new CodebaseService();
