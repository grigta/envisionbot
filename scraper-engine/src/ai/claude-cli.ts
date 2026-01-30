/**
 * Claude CLI Integration
 * Uses Claude Code CLI with --print for AI analysis via Max subscription
 *
 * Key trick: Remove ANTHROPIC_API_KEY from env to force CLI to use OAuth token
 */

import { execSync, spawn } from 'child_process';

export interface ClaudeCliOptions {
  model?: string;
  maxTokens?: number;
  timeout?: number;
}

export interface ClaudeCliResult {
  content: string;
  tokensUsed: number;
}

/**
 * Check if Claude CLI is available
 */
export function isClaudeCliAvailable(): boolean {
  try {
    execSync('which claude', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run Claude CLI with --print flag using Max subscription
 */
export async function runClaudeCli(
  prompt: string,
  options: ClaudeCliOptions = {}
): Promise<ClaudeCliResult> {
  const { model, timeout = 120000 } = options;

  return new Promise((resolve, reject) => {
    // Build environment without ANTHROPIC_API_KEY to force subscription
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    env.CLAUDE_USE_SUBSCRIPTION = 'true';

    // Build args - Claude CLI doesn't support --max-tokens, it manages limits internally
    const args = ['--print'];
    if (model) {
      args.push('--model', model);
    }
    args.push(prompt);

    const child = spawn('claude', args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'], // ignore stdin to prevent blocking
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Claude CLI timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        return;
      }

      // Estimate tokens (rough approximation)
      const tokensUsed = Math.ceil((prompt.length + stdout.length) / 4);

      resolve({
        content: stdout.trim(),
        tokensUsed,
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Claude CLI error: ${error.message}`));
    });
  });
}

/**
 * Parse JSON from Claude CLI output
 * Handles various formats: raw JSON, markdown code blocks, or JSON embedded in text
 */
export function parseJsonFromCli<T>(output: string): T {
  let jsonStr = output.trim();

  // Try to extract JSON from markdown code blocks
  if (jsonStr.includes('```')) {
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
  }

  // Try to extract JSON object from surrounding text
  if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
    // Find first { or [ and last } or ]
    const firstBrace = jsonStr.indexOf('{');
    const firstBracket = jsonStr.indexOf('[');
    const start = firstBrace === -1 ? firstBracket :
                  firstBracket === -1 ? firstBrace :
                  Math.min(firstBrace, firstBracket);

    if (start !== -1) {
      const isArray = jsonStr[start] === '[';
      const closingChar = isArray ? ']' : '}';
      const lastClose = jsonStr.lastIndexOf(closingChar);

      if (lastClose !== -1 && lastClose > start) {
        jsonStr = jsonStr.slice(start, lastClose + 1);
      }
    }
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch (error) {
    // Include original output in error for debugging
    const preview = output.slice(0, 200);
    throw new Error(`Failed to parse JSON from CLI output: ${error instanceof Error ? error.message : String(error)}\nOutput preview: ${preview}...`);
  }
}
