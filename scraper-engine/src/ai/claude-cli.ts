/**
 * Claude CLI Integration
 * Uses Claude Code CLI with --print for AI analysis via Max subscription
 * Includes retry logic and improved error handling
 *
 * Key trick: Remove ANTHROPIC_API_KEY from env to force CLI to use OAuth token
 */

import { execSync, spawn } from 'child_process';

export interface ClaudeCliOptions {
  model?: string;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ClaudeCliResult {
  content: string;
  tokensUsed: number;
}

/**
 * Custom error class for Claude CLI failures
 */
export class ClaudeCliError extends Error {
  constructor(
    message: string,
    public exitCode?: number,
    public stderr?: string,
    public isTimeout = false,
    public isRetryable = false
  ) {
    super(message);
    this.name = 'ClaudeCliError';
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: ClaudeCliError | Error | string): boolean {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const lowerMessage = errorMessage.toLowerCase();

  const retryablePatterns = [
    'network error',
    'connection refused',
    'timeout',
    'econnrefused',
    'enotfound',
    'etimedout',
    'socket hang up',
    'rate limit',
    '503',
    '502',
    '500',
  ];

  return retryablePatterns.some((pattern) => lowerMessage.includes(pattern));
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
 * Includes retry logic with exponential backoff for transient failures
 */
export async function runClaudeCli(
  prompt: string,
  options: ClaudeCliOptions = {}
): Promise<ClaudeCliResult> {
  const { model, timeout = 120000, maxRetries = 3, retryDelay = 1000 } = options;

  let lastError: ClaudeCliError | Error | undefined;
  let delay = retryDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runClaudeCliInternal(prompt, model, timeout);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isLastAttempt = attempt === maxRetries;
      const shouldRetry = error instanceof ClaudeCliError ? error.isRetryable : isRetryableError(lastError);

      if (isLastAttempt || !shouldRetry) {
        console.error(`[ClaudeCLI] Failed after ${attempt} attempt(s):`, error);
        throw error;
      }

      console.warn(`[ClaudeCLI] Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`, error);
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }

  throw lastError || new ClaudeCliError('Unknown error');
}

/**
 * Internal function to run Claude CLI (used by retry logic)
 */
function runClaudeCliInternal(
  prompt: string,
  model: string | undefined,
  timeout: number
): Promise<ClaudeCliResult> {
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
    let isResolved = false;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      if (isResolved) return;
      isResolved = true;

      console.warn(`[ClaudeCLI] Timeout after ${timeout}ms, attempting graceful shutdown`);
      child.kill('SIGTERM');

      // Give the process 5 seconds to clean up before forcing kill
      setTimeout(() => {
        if (!child.killed) {
          console.warn('[ClaudeCLI] Process did not terminate gracefully, sending SIGKILL');
          child.kill('SIGKILL');
        }
      }, 5000);

      reject(
        new ClaudeCliError(
          `Claude CLI timed out after ${timeout}ms`,
          undefined,
          stderr,
          true,
          true // Timeouts are retryable
        )
      );
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      if (isResolved) return;
      isResolved = true;

      if (code !== 0) {
        const errorMessage = stderr || stdout || 'Unknown error';
        const isRetryable = isRetryableError(errorMessage);
        reject(
          new ClaudeCliError(
            `Claude CLI exited with code ${code}: ${errorMessage}`,
            code,
            stderr,
            false,
            isRetryable
          )
        );
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
      if (isResolved) return;
      isResolved = true;

      console.error('[ClaudeCLI] Process error:', error);
      reject(
        new ClaudeCliError(
          `Claude CLI error: ${error.message}`,
          undefined,
          undefined,
          false,
          true // Spawn errors are often retryable
        )
      );
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
