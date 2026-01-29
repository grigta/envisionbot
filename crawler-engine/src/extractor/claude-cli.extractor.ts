/**
 * Claude CLI Extractor
 * Uses Claude Code CLI with Max subscription instead of direct API
 * This bypasses the OAuth limitation by using `claude --print` mode
 * Includes retry logic and improved error handling
 */

import { spawn } from 'child_process';
import type { Extractor, ExtractionConfig, ExtractionResult } from '../types.js';

const DEFAULT_TIMEOUT = 180000; // 3 minutes - Opus 4.5 needs more time

export interface ClaudeCLIExtractorOptions {
  /** Path to claude CLI binary (optional, defaults to 'claude') */
  claudePath?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts for transient failures */
  maxRetries?: number;
  /** Initial delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * Custom error class for Claude CLI extraction failures
 */
export class ClaudeCLIError extends Error {
  constructor(
    message: string,
    public exitCode?: number,
    public stderr?: string,
    public isTimeout = false,
    public isRetryable = false
  ) {
    super(message);
    this.name = 'ClaudeCLIError';
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
function isRetryableError(error: ClaudeCLIError | Error | string): boolean {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const lowerMessage = errorMessage.toLowerCase();

  // Network and transient errors are retryable
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

export class ClaudeCLIExtractor implements Extractor {
  private claudePath: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(options: ClaudeCLIExtractorOptions = {}) {
    this.claudePath = options.claudePath || 'claude';
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
  }

  /**
   * Extract structured data from content using Claude Code CLI
   * Includes retry logic with exponential backoff for transient failures
   */
  async extract(content: string, config: ExtractionConfig): Promise<ExtractionResult> {
    const startTime = Date.now();
    const prompt = this.buildPrompt(content, config);

    console.log(`[ClaudeCLI] Starting extraction, content length: ${content.length}, prompt length: ${prompt.length}`);

    let lastError: ClaudeCLIError | Error | undefined;
    let delay = this.retryDelay;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.runClaudeCLI(prompt);
        const elapsed = Date.now() - startTime;
        console.log(`[ClaudeCLI] Extraction completed in ${elapsed}ms, response length: ${response.length}`);

        const parsed = this.parseResponse(response, config);

        return {
          data: parsed.data,
          raw: response,
          model: 'claude-cli-subscription',
          inputTokens: 0, // CLI doesn't report tokens
          outputTokens: 0,
          extractedAt: Date.now(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const elapsed = Date.now() - startTime;

        const isLastAttempt = attempt === this.maxRetries;
        const shouldRetry = error instanceof ClaudeCLIError ? error.isRetryable : isRetryableError(lastError);

        if (isLastAttempt || !shouldRetry) {
          console.error(`[ClaudeCLI] Extraction failed after ${elapsed}ms and ${attempt} attempt(s):`, error);
          throw new ClaudeCLIError(
            `Claude CLI extraction failed after ${attempt} attempt(s): ${lastError.message}`,
            error instanceof ClaudeCLIError ? error.exitCode : undefined,
            error instanceof ClaudeCLIError ? error.stderr : undefined,
            error instanceof ClaudeCLIError ? error.isTimeout : false,
            false
          );
        }

        console.warn(`[ClaudeCLI] Attempt ${attempt}/${this.maxRetries} failed, retrying in ${delay}ms...`, error);
        await sleep(delay);
        delay *= 2; // Exponential backoff
      }
    }

    // Should not reach here, but TypeScript needs this
    throw lastError || new Error('Unknown extraction error');
  }

  /**
   * Run claude CLI with --print flag using subscription auth
   * Includes improved error handling and timeout management
   */
  private runClaudeCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Prepare environment - remove API key to force subscription usage
      const env = { ...process.env };
      delete env.ANTHROPIC_API_KEY;
      env.ANTHROPIC_API_KEY = ''; // Also set to empty
      env.CLAUDE_USE_SUBSCRIPTION = 'true';
      env.CLAUDE_CODE_ENTRYPOINT = 'crawler-engine';

      // Optimize CLI for speed:
      // --print: non-interactive mode (reads from stdin if no prompt arg)
      // --max-turns 3: allow up to 3 iterations (enough for extraction)
      // --output-format json: structured output with metadata
      // --model: use Opus 4.5 for best extraction quality
      // --dangerously-skip-permissions: no permission prompts
      // NOTE: Passing prompt via stdin to avoid command-line length limits
      const args = [
        '--print',
        '--max-turns', '3',
        '--output-format', 'json',
        '--model', 'claude-opus-4-5-20251101',
        '--dangerously-skip-permissions',
      ];

      const proc = spawn(this.claudePath, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout;
      let isResolved = false;

      // Write prompt to stdin with error handling
      try {
        if (proc.stdin) {
          proc.stdin.write(prompt);
          proc.stdin.end();
        } else {
          reject(new ClaudeCLIError('Failed to access stdin', undefined, undefined, false, false));
          return;
        }
      } catch (error) {
        reject(
          new ClaudeCLIError(
            `Failed to write to stdin: ${error instanceof Error ? error.message : String(error)}`,
            undefined,
            undefined,
            false,
            false
          )
        );
        return;
      }

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (isResolved) return;
        isResolved = true;

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          const errorMessage = stderr || stdout || 'Unknown error';
          const isRetryable = isRetryableError(errorMessage);
          reject(
            new ClaudeCLIError(
              `Claude CLI exited with code ${code}: ${errorMessage}`,
              code,
              stderr,
              false,
              isRetryable
            )
          );
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        if (isResolved) return;
        isResolved = true;

        console.error('[ClaudeCLI] Process error:', error);
        reject(
          new ClaudeCLIError(
            `Failed to start Claude CLI: ${error.message}`,
            undefined,
            undefined,
            false,
            true // Spawn errors are often retryable
          )
        );
      });

      // Handle timeout with graceful shutdown
      timeoutId = setTimeout(() => {
        if (isResolved) return;
        isResolved = true;

        console.warn(`[ClaudeCLI] Timeout after ${this.timeout}ms, attempting graceful shutdown`);
        proc.kill('SIGTERM');

        // Give the process 5 seconds to clean up before forcing kill
        setTimeout(() => {
          if (!proc.killed) {
            console.warn('[ClaudeCLI] Process did not terminate gracefully, sending SIGKILL');
            proc.kill('SIGKILL');
          }
        }, 5000);

        reject(
          new ClaudeCLIError(
            `Claude CLI timed out after ${this.timeout}ms`,
            undefined,
            stderr,
            true,
            true // Timeouts are retryable
          )
        );
      }, this.timeout);
    });
  }

  /**
   * Build extraction prompt
   */
  private buildPrompt(content: string, config: ExtractionConfig): string {
    const lang = config.outputLanguage || 'ru';
    // Limit content aggressively to avoid CLI timeout - take first 10K chars
    const truncatedContent = content.slice(0, 10000);

    if (config.extractionType === 'schema' && config.schema) {
      return `${config.prompt || 'Извлеки данные из контента.'} Schema: ${JSON.stringify(config.schema)}. Контент: ${truncatedContent}. Верни ТОЛЬКО JSON:`;
    }

    return `${config.prompt || 'Извлеки элементы.'} Формат:[{"title":"...","url":"...","description":"..."}]. Контент: ${truncatedContent}. JSON (${lang}):`;
  }

  /**
   * Parse Claude's response
   */
  private parseResponse(response: string, config: ExtractionConfig): { data: unknown } {
    let actualResult = response.trim();

    // Check if response is in JSON output format (from --output-format json)
    try {
      const outputJson = JSON.parse(response);
      if (outputJson.type === 'result' && outputJson.result) {
        actualResult = outputJson.result;
        console.log(`[ClaudeCLI] Extracted result from JSON output format (${outputJson.num_turns} turns, ${outputJson.duration_ms}ms)`);
      }
    } catch {
      // Not JSON output format, continue with raw response
    }

    // Remove markdown code blocks if present
    const jsonMatch = actualResult.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      actualResult = jsonMatch[1].trim();
    }

    // Try to find JSON array or object
    const arrayMatch = actualResult.match(/\[[\s\S]*\]/);
    const objectMatch = actualResult.match(/\{[\s\S]*\}/);

    let jsonStr = actualResult;
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    } else if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    try {
      const data = JSON.parse(jsonStr);
      return { data };
    } catch (e) {
      console.error('[ClaudeCLI] Failed to parse JSON:', e);
      // If parsing fails, return raw response wrapped in array
      return {
        data: [{
          title: 'Extracted Content',
          content: actualResult,
          metadata: { parseError: 'Failed to parse JSON' },
        }],
      };
    }
  }
}

export function createClaudeCLIExtractor(options?: ClaudeCLIExtractorOptions): ClaudeCLIExtractor {
  return new ClaudeCLIExtractor(options);
}
