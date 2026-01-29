import { execa, type ResultPromise } from "execa";
import { spawn } from "child_process";
import type { Project, CodebaseAnalysisResult } from "../types.js";

export interface ClaudeCodeResult {
  success: boolean;
  output: string;
  exitCode?: number;
  error?: string;
  attemptsMade?: number;
}

export class ClaudeCodeError extends Error {
  constructor(
    message: string,
    public exitCode?: number,
    public stderr?: string,
    public stdout?: string,
    public isTimeout = false,
    public isRetryable = false
  ) {
    super(message);
    this.name = "ClaudeCodeError";
  }
}

/**
 * Retry configuration for Claude Code operations
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof ClaudeCodeError) {
    return error.isRetryable;
  }

  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Network and transient errors are retryable
  const retryablePatterns = [
    "network error",
    "connection refused",
    "timeout",
    "econnrefused",
    "enotfound",
    "etimedout",
    "socket hang up",
    "rate limit",
    "503",
    "502",
    "500",
  ];

  return retryablePatterns.some((pattern) => errorMessage.includes(pattern));
}

/**
 * Execute a function with retry logic and exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context = "Operation"
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;
  let delay = retryConfig.initialDelay;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === retryConfig.maxAttempts;
      const shouldRetry = isRetryableError(error);

      if (isLastAttempt || !shouldRetry) {
        console.error(`[${context}] Failed after ${attempt} attempt(s):`, error);
        throw error;
      }

      console.warn(`[${context}] Attempt ${attempt}/${retryConfig.maxAttempts} failed, retrying in ${delay}ms...`, error);
      await sleep(delay);

      delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelay);
    }
  }

  throw lastError;
}

// Stream event types from Claude Code CLI
export interface StreamEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

export interface AgentStep {
  id: string;
  type: "thinking" | "tool_use" | "tool_result" | "text" | "error" | "complete";
  timestamp: number;
  content: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  status?: "running" | "completed" | "failed";
}

// Callback for streaming events
export type StreamCallback = (event: AgentStep) => void;

/**
 * Run Claude Code CLI with a prompt
 * Uses the --print flag for non-interactive execution
 * Passes prompt via stdin to avoid command line length issues
 * Includes retry logic with exponential backoff for transient failures
 */
export async function runClaudeCode(
  workDir: string,
  prompt: string,
  options?: {
    timeout?: number;
    allowEdits?: boolean;
    retryConfig?: Partial<RetryConfig>;
  }
): Promise<ClaudeCodeResult> {
  const timeout = options?.timeout || 600000; // 10 minutes default
  const retryConfig = options?.retryConfig || {};

  return withRetry(
    async () => {
      try {
        // Build the command arguments
        // Using --print for non-interactive mode
        // Prompt will be passed via stdin
        const args = ["--print"];

        // If we want to allow edits (file modifications), use --dangerously-skip-permissions
        if (options?.allowEdits !== false) {
          args.push("--dangerously-skip-permissions");
        }

        console.log(`[ClaudeCode] Running in ${workDir} with timeout ${timeout}ms`);

        const result = await execa("claude", args, {
          cwd: workDir,
          timeout,
          input: prompt, // Pass prompt via stdin
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
          },
        });

        console.log("[ClaudeCode] Completed successfully");

        return {
          success: true,
          output: result.stdout,
          exitCode: result.exitCode,
        };
      } catch (error) {
        // Enhanced error handling with context
        if (error instanceof Error && "exitCode" in error) {
          const execaError = error as unknown as {
            exitCode: number;
            stderr?: string;
            stdout?: string;
            message: string;
            timedOut?: boolean;
          };

          const isTimeout = execaError.timedOut || execaError.message.toLowerCase().includes("timeout");
          const isRetryable = isTimeout || isRetryableError(error);

          console.error(`[ClaudeCode] Failed with exit code ${execaError.exitCode}:`, {
            message: execaError.message,
            stderr: execaError.stderr?.slice(0, 200),
            isTimeout,
            isRetryable,
          });

          const claudeError = new ClaudeCodeError(
            `Claude Code failed: ${execaError.message}`,
            execaError.exitCode,
            execaError.stderr,
            execaError.stdout,
            isTimeout,
            isRetryable
          );

          throw claudeError;
        }

        console.error("[ClaudeCode] Unexpected error:", error);
        const claudeError = new ClaudeCodeError(
          error instanceof Error ? error.message : "Unknown error",
          undefined,
          undefined,
          undefined,
          false,
          isRetryableError(error)
        );
        throw claudeError;
      }
    },
    retryConfig,
    "ClaudeCode"
  ).catch((error) => {
    // Convert final error to ClaudeCodeResult
    const claudeError = error instanceof ClaudeCodeError ? error : new ClaudeCodeError(String(error));
    return {
      success: false,
      output: claudeError.stderr || claudeError.stdout || claudeError.message,
      exitCode: claudeError.exitCode,
      error: claudeError.message,
      attemptsMade: retryConfig.maxAttempts || DEFAULT_RETRY_CONFIG.maxAttempts,
    };
  });
}

/**
 * Run Claude Code with a complex multi-step task
 * Useful for project generation where multiple files need to be created
 */
export async function runClaudeCodeTask(
  workDir: string,
  task: string,
  context?: {
    projectName?: string;
    techStack?: string[];
    features?: string[];
  }
): Promise<ClaudeCodeResult> {
  // Build a comprehensive prompt for code generation
  let prompt = task;

  if (context) {
    const contextParts: string[] = [];

    if (context.projectName) {
      contextParts.push(`Project name: ${context.projectName}`);
    }
    if (context.techStack?.length) {
      contextParts.push(`Tech stack: ${context.techStack.join(", ")}`);
    }
    if (context.features?.length) {
      contextParts.push(`Features to implement:\n${context.features.map((f) => `- ${f}`).join("\n")}`);
    }

    if (contextParts.length > 0) {
      prompt = `${contextParts.join("\n\n")}\n\nTask: ${task}`;
    }
  }

  return runClaudeCode(workDir, prompt, {
    timeout: 900000, // 15 minutes for complex tasks
    allowEdits: true,
  });
}

/**
 * Generate a complete project structure using Claude Code
 */
export async function generateProject(
  workDir: string,
  projectConfig: {
    name: string;
    description: string;
    techStack: string[];
    features: { name: string; description: string; priority: string }[];
  }
): Promise<ClaudeCodeResult> {
  const coreFeatures = projectConfig.features
    .filter((f) => f.priority === "core")
    .map((f) => `- ${f.name}: ${f.description}`)
    .join("\n");

  const importantFeatures = projectConfig.features
    .filter((f) => f.priority === "important")
    .map((f) => `- ${f.name}: ${f.description}`)
    .join("\n");

  const prompt = `Create a complete project with the following specifications:

Project: ${projectConfig.name}
Description: ${projectConfig.description}

Tech Stack: ${projectConfig.techStack.join(", ")}

Core Features (must implement):
${coreFeatures || "- Basic project structure"}

Important Features (implement if possible):
${importantFeatures || "- None specified"}

Requirements:
1. Create all necessary files and directories
2. Set up proper project configuration (package.json, tsconfig, etc.)
3. Include a README.md with setup instructions
4. Add basic .gitignore
5. Make the project immediately runnable after npm install

Please create this project structure and implement the core features.`;

  return runClaudeCode(workDir, prompt, {
    timeout: 900000,
    allowEdits: true,
  });
}

/**
 * Check if Claude Code CLI is available
 * Returns detailed information about availability and version
 */
export async function isClaudeCodeAvailable(): Promise<boolean> {
  try {
    const result = await execa("claude", ["--version"], { timeout: 5000 });
    console.log("[ClaudeCode] CLI is available, version:", result.stdout.trim());
    return true;
  } catch (error) {
    console.warn("[ClaudeCode] CLI not available:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Get detailed Claude Code CLI status including version and auth
 */
export async function getClaudeCodeStatus(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const result = await execa("claude", ["--version"], { timeout: 5000 });
    return {
      available: true,
      version: result.stdout.trim(),
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Run a general agent task using Claude Code CLI
 * Returns the response text
 */
export async function runAgentTask(
  prompt: string,
  options?: { timeout?: number; allowCommands?: boolean }
): Promise<{ success: boolean; response: string; error?: string }> {
  const timeout = options?.timeout || 300000; // 5 minutes
  const allowCommands = options?.allowCommands ?? true; // Allow gh and other read commands by default

  try {
    const result = await runClaudeCode(process.cwd(), prompt, {
      timeout,
      allowEdits: allowCommands, // This enables --dangerously-skip-permissions for shell commands
    });

    if (!result.success) {
      return { success: false, response: "", error: result.output };
    }

    return { success: true, response: result.output };
  } catch (error) {
    return {
      success: false,
      response: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Run Claude Code with streaming output and real-time event callbacks
 * Uses --output-format stream-json for detailed progress
 * Includes improved error handling and timeout management
 */
export async function runClaudeCodeStreaming(
  workDir: string,
  prompt: string,
  onStep: StreamCallback,
  options?: {
    timeout?: number;
    allowEdits?: boolean;
    retryConfig?: Partial<RetryConfig>;
  }
): Promise<ClaudeCodeResult> {
  const timeout = options?.timeout || 600000;
  const retryConfig = options?.retryConfig || {};

  // Wrap the streaming logic with retry
  return withRetry(
    async () => {
      return new Promise<ClaudeCodeResult>((resolve, reject) => {
        // --verbose is required when using --output-format stream-json with --print
        const args = ["--print", "--verbose", "--output-format", "stream-json"];

        if (options?.allowEdits !== false) {
          args.push("--dangerously-skip-permissions");
        }

        console.log(`[ClaudeCode Streaming] Running in ${workDir} with timeout ${timeout}ms`);
        console.log(`[ClaudeCode Streaming] Args: ${args.join(" ")}`);

        const child = spawn("claude", args, {
          cwd: workDir,
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
          },
        });

        let fullOutput = "";
        let textContent = "";
        let currentToolId: string | null = null;
        let stepCounter = 0;
        let isResolved = false;
        let stderrOutput = "";

        // Manual timeout handler since spawn doesn't support timeout option
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            console.error(`[ClaudeCode Streaming] Timed out after ${timeout}ms`);
            child.kill("SIGTERM");

            // Give the process a grace period to clean up
            setTimeout(() => {
              if (!child.killed) {
                console.warn("[ClaudeCode Streaming] Process did not terminate, sending SIGKILL");
                child.kill("SIGKILL");
              }
            }, 5000);

            onStep({
              id: `step-${++stepCounter}`,
              type: "error",
              timestamp: Date.now(),
              content: `Timeout after ${timeout / 1000} seconds`,
              status: "failed",
            });

            isResolved = true;
            const timeoutError = new ClaudeCodeError(
              `Claude Code timed out after ${timeout}ms`,
              undefined,
              stderrOutput,
              textContent || fullOutput,
              true,
              true // Timeouts are retryable
            );
            reject(timeoutError);
          }
        }, timeout);

        // Send prompt via stdin with error handling
        try {
          console.log(`[ClaudeCode Streaming] Sending prompt (${prompt.length} chars) via stdin...`);
          child.stdin.write(prompt);
          child.stdin.end();
        } catch (error) {
          clearTimeout(timeoutId);
          isResolved = true;
          reject(
            new ClaudeCodeError(`Failed to write prompt to stdin: ${error instanceof Error ? error.message : String(error)}`)
          );
          return;
        }

    // Process stdout line by line (NDJSON format)
    let buffer = "";
    child.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      console.log(`Received stdout chunk (${chunk.length} chars)`);
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        fullOutput += line + "\n";

        try {
          const event = JSON.parse(line);
          const step = parseStreamEvent(event, ++stepCounter, currentToolId);

          if (step) {
            // Track tool IDs for pairing results
            if (step.type === "tool_use" && step.toolName) {
              currentToolId = step.id;
            } else if (step.type === "tool_result") {
              currentToolId = null;
            }

            // Accumulate text content
            if (step.type === "text") {
              textContent += step.content;
            }

            onStep(step);
          }
        } catch {
          // Not valid JSON, might be partial line or non-JSON output
          console.log(`Non-JSON line: ${line.slice(0, 100)}`);
        }
      }
    });

        child.stderr.on("data", (data: Buffer) => {
          const errorText = data.toString();
          stderrOutput += errorText;
          console.error("[ClaudeCode Streaming] stderr:", errorText.slice(0, 200));
          onStep({
            id: `step-${++stepCounter}`,
            type: "error",
            timestamp: Date.now(),
            content: errorText,
            status: "failed",
          });
        });

        child.on("close", (code) => {
          clearTimeout(timeoutId);
          if (isResolved) return;
          isResolved = true;

          console.log(`[ClaudeCode Streaming] Process closed with code ${code}`);

          // Process any remaining buffer
          if (buffer.trim()) {
            try {
              const event = JSON.parse(buffer);
              const step = parseStreamEvent(event, ++stepCounter, currentToolId);
              if (step) onStep(step);
            } catch (error) {
              console.warn("[ClaudeCode Streaming] Failed to parse remaining buffer:", error);
            }
          }

          const finalStatus = code === 0 ? "completed" : "failed";
          onStep({
            id: `step-${++stepCounter}`,
            type: "complete",
            timestamp: Date.now(),
            content: code === 0 ? "Task completed" : `Task failed with exit code ${code}`,
            status: finalStatus,
          });

          if (code === 0) {
            resolve({
              success: true,
              output: textContent || fullOutput,
              exitCode: code ?? undefined,
            });
          } else {
            // Non-zero exit code - create error for potential retry
            const error = new ClaudeCodeError(
              `Claude Code exited with code ${code}`,
              code ?? undefined,
              stderrOutput,
              textContent || fullOutput,
              false,
              isRetryableError(new Error(stderrOutput))
            );
            reject(error);
          }
        });

        child.on("error", (error) => {
          clearTimeout(timeoutId);
          if (isResolved) return;
          isResolved = true;

          console.error("[ClaudeCode Streaming] Spawn error:", error);
          onStep({
            id: `step-${++stepCounter}`,
            type: "error",
            timestamp: Date.now(),
            content: `Process error: ${error.message}`,
            status: "failed",
          });

          const claudeError = new ClaudeCodeError(
            `Failed to spawn Claude Code process: ${error.message}`,
            undefined,
            stderrOutput,
            textContent || fullOutput,
            false,
            true // Spawn errors are often retryable
          );
          reject(claudeError);
        });
      });
    },
    retryConfig,
    "ClaudeCode Streaming"
  ).catch((error) => {
    // Convert final error to ClaudeCodeResult
    const claudeError = error instanceof ClaudeCodeError ? error : new ClaudeCodeError(String(error));
    return {
      success: false,
      output: claudeError.stderr || claudeError.stdout || claudeError.message,
      exitCode: claudeError.exitCode,
      error: claudeError.message,
      attemptsMade: retryConfig.maxAttempts || DEFAULT_RETRY_CONFIG.maxAttempts,
    };
  });
}

/**
 * Parse a stream-json event into AgentStep(s)
 * Claude Code CLI outputs NDJSON with these event types:
 * - system/init: Agent initialization with tools list
 * - assistant: Message with content array (text, tool_use, tool_result)
 * - user: User messages including tool results
 * - result: Final result with success/error status
 */
function parseStreamEvent(event: unknown, stepNum: number, currentToolId: string | null): AgentStep | null {
  if (!event || typeof event !== "object") return null;

  const e = event as Record<string, unknown>;
  const timestamp = Date.now();
  const id = `step-${stepNum}`;

  // System init event - skip, don't show to user
  if (e.type === "system" && e.subtype === "init") {
    return null;
  }

  // Assistant message with content array
  if (e.type === "assistant") {
    const message = e.message as Record<string, unknown> | undefined;
    if (message?.content && Array.isArray(message.content)) {
      const content = message.content as Array<Record<string, unknown>>;

      // Process each content block
      for (const block of content) {
        if (block.type === "text" && block.text) {
          return {
            id,
            type: "text",
            timestamp,
            content: block.text as string,
            status: "running",
          };
        }

        if (block.type === "tool_use") {
          return {
            id,
            type: "tool_use",
            timestamp,
            content: `Using tool: ${block.name}`,
            toolName: block.name as string,
            toolInput: block.input,
            status: "running",
          };
        }

        if (block.type === "thinking" && block.thinking) {
          return {
            id,
            type: "thinking",
            timestamp,
            content: block.thinking as string,
            status: "running",
          };
        }
      }
    }
  }

  // User message (often contains tool results)
  if (e.type === "user") {
    const message = e.message as Record<string, unknown> | undefined;
    if (message?.content && Array.isArray(message.content)) {
      const content = message.content as Array<Record<string, unknown>>;

      for (const block of content) {
        if (block.type === "tool_result") {
          const toolContent = block.content;
          return {
            id,
            type: "tool_result",
            timestamp,
            content: typeof toolContent === "string" ? toolContent : JSON.stringify(toolContent),
            toolOutput: toolContent,
            status: "completed",
          };
        }
      }
    }
  }

  // Final result
  if (e.type === "result") {
    const result = e.result as string | undefined;
    const isError = e.is_error as boolean | undefined;
    const subtype = e.subtype as string | undefined;

    if (result) {
      return {
        id,
        type: isError ? "error" : "text",
        timestamp,
        content: result,
        status: subtype === "success" ? "completed" : "failed",
      };
    }
  }

  return null;
}

/**
 * Run agent task with streaming - broadcasts events in real-time
 */
export async function runAgentTaskStreaming(
  prompt: string,
  onStep: StreamCallback,
  options?: { timeout?: number; allowCommands?: boolean }
): Promise<{ success: boolean; response: string; error?: string }> {
  const timeout = options?.timeout || 300000;
  const allowCommands = options?.allowCommands ?? true;

  try {
    const result = await runClaudeCodeStreaming(process.cwd(), prompt, onStep, {
      timeout,
      allowEdits: allowCommands,
    });

    if (!result.success) {
      return { success: false, response: "", error: result.output };
    }

    return { success: true, response: result.output };
  } catch (error) {
    return {
      success: false,
      response: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Plan an idea using Claude Code CLI (uses subscription auth)
 * Returns structured plan as JSON
 */
export async function planIdeaWithClaudeCode(
  idea: { title: string; description: string }
): Promise<{
  success: boolean;
  plan?: {
    summary: string;
    techStack: string[];
    structure: { path: string; type: "file" | "directory"; description: string }[];
    features: { name: string; description: string; priority: "core" | "important" | "nice-to-have" }[];
    estimatedFiles: number;
    repoNameSuggestion: string;
  };
  error?: string;
}> {
  const prompt = `Analyze this software project idea and create an implementation plan.

**Idea Title:** ${idea.title}

**Description:**
${idea.description}

Return your response as a JSON object with this exact structure (no markdown code blocks, just pure JSON):
{
  "summary": "Brief 1-2 sentence summary of what the project will do",
  "techStack": ["list", "of", "technologies"],
  "structure": [
    {"path": "src/", "type": "directory", "description": "Source code"},
    {"path": "src/index.ts", "type": "file", "description": "Entry point"}
  ],
  "features": [
    {"name": "Feature name", "description": "What it does", "priority": "core"},
    {"name": "Another feature", "description": "Description", "priority": "important"}
  ],
  "estimatedFiles": 10,
  "repoNameSuggestion": "suggested-repo-name"
}

Rules:
- priority must be one of: "core", "important", "nice-to-have"
- type must be one of: "file", "directory"
- Keep structure to key files/directories only (5-15 items)
- Be realistic and practical
- Focus on creating a working MVP

Return ONLY the JSON object, no explanation.`;

  try {
    const result = await runClaudeCode(process.cwd(), prompt, {
      timeout: 300000, // 5 minutes
      allowEdits: false,
    });

    if (!result.success) {
      return { success: false, error: result.output };
    }

    // Parse the JSON from the output
    // Claude might include some text, so try to find the JSON object
    const output = result.output.trim();
    let jsonStr = output;

    // Try to extract JSON from the output
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const plan = JSON.parse(jsonStr);

      // Validate required fields
      if (!plan.summary || !plan.techStack || !plan.features) {
        return { success: false, error: "Invalid plan structure returned" };
      }

      return { success: true, plan };
    } catch (parseError) {
      return { success: false, error: `Failed to parse plan JSON: ${output.slice(0, 200)}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Analyze a project's codebase and generate a development plan
 * Uses Claude Code to understand the current state and suggest improvements
 * Supports context from previous plan versions for continuity
 */
export async function analyzeProjectCodebase(
  repoPath: string,
  project: { name: string; repo: string; phase: string },
  onStep?: StreamCallback,
  previousPlan?: { markdown: string; version: number; analysisSummary?: string }
): Promise<{
  success: boolean;
  planMarkdown?: string;
  analysis?: CodebaseAnalysisResult;
  error?: string;
}> {
  // Build context from previous plan if exists
  const previousPlanContext = previousPlan
    ? `
ПРЕДЫДУЩИЙ ПЛАН (версия ${previousPlan.version}):
${previousPlan.markdown}

${previousPlan.analysisSummary ? `Предыдущая сводка: ${previousPlan.analysisSummary}` : ""}

ИНСТРУКЦИИ ПО ОБНОВЛЕНИЮ:
- Сохрани контекст и преемственность с предыдущим планом
- Отметь задачи как выполненные [x], если они завершены в коде
- Добавь новые задачи на основе изменений в кодовой базе
- Обнови статус задач "В работе" на основе текущего состояния
- Выдели ключевые изменения с прошлой версии
- Сохрани структуру и формат предыдущего плана

`
    : "";

  const prompt = `Ты анализируешь кодовую базу для ${previousPlan ? "обновления" : "создания"} плана разработки.
${previousPlanContext}

Проект: ${project.name}
Репозиторий: ${project.repo}
Текущая фаза: ${project.phase}

ВАЖНО: Ты находишься в директории проекта. Тщательно изучи код перед созданием плана.

Твои задачи:
1. Изучить структуру проекта (файлы, директории)
2. Определить технологический стек
3. Понять, какие фичи уже реализованы
4. Найти, что не доделано или можно улучшить
5. Выявить технический долг и проблемы с качеством кода
6. Определить риски и блокеры
7. Предложить следующие шаги разработки с приоритетами

После анализа выведи план разработки СТРОГО в следующем markdown формате:

---
project_id: "${project.name}"
generated_at: "${new Date().toISOString()}"
updated_at: "${new Date().toISOString()}"
version: 1
status: "active"
---

# План разработки: ${project.name}

## Обзор
[Краткое описание проекта и его текущего состояния в 2-3 предложениях]

## Технологии
- [Список технологий, фреймворков и инструментов]

## Текущее состояние

### Реализовано
- [x] Фича 1 — краткое описание
- [x] Фича 2 — краткое описание

### В работе
- [ ] Фича — описание

## Дорожная карта

### Фаза 1: MVP (Критично)
- [ ] Задача 1 — описание — приоритет: критический
- [ ] Задача 2 — описание — приоритет: высокий

### Фаза 2: Улучшения (Важно)
- [ ] Задача 3 — описание — приоритет: средний

### Фаза 3: Полировка (Желательно)
- [ ] Задача 4 — описание — приоритет: низкий

## Технический долг
- Проблема 1: описание и рекомендация по исправлению
- Проблема 2: описание и рекомендация по исправлению

## Риски и блокеры
- Риск 1: описание и стратегия митигации

## Заметки
[Дополнительные наблюдения и рекомендации]

ПРАВИЛА:
1. Будь конкретным в описании задач
2. Каждая задача должна быть выполнимой AI-агентом
3. Приоритизируй задачи по влиянию на проект
4. План должен быть реалистичным
5. Выводи ТОЛЬКО markdown план, без лишнего текста до или после
6. Отвечай ТОЛЬКО на русском языке`;

  try {
    let planMarkdown = "";

    if (onStep) {
      // Streaming mode
      const result = await runClaudeCodeStreaming(repoPath, prompt, onStep, {
        timeout: 600000, // 10 minutes for analysis
        allowEdits: false, // Read-only analysis
      });

      if (!result.success) {
        return { success: false, error: result.output };
      }

      planMarkdown = result.output;
    } else {
      // Non-streaming mode
      const result = await runClaudeCode(repoPath, prompt, {
        timeout: 600000,
        allowEdits: false,
      });

      if (!result.success) {
        return { success: false, error: result.output };
      }

      planMarkdown = result.output;
    }

    // Clean up the output - extract just the markdown plan
    const cleanedMarkdown = extractPlanMarkdown(planMarkdown);

    // Parse the analysis from the markdown
    const analysis = parseAnalysisFromMarkdown(cleanedMarkdown);

    return {
      success: true,
      planMarkdown: cleanedMarkdown,
      analysis,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Extract the plan markdown from Claude's output
 * Handles duplicates and cleans up extra content
 */
function extractPlanMarkdown(output: string): string {
  // Try to find the YAML frontmatter start
  const frontmatterMatch = output.match(/---\s*\nproject_id:/);
  if (frontmatterMatch && frontmatterMatch.index !== undefined) {
    let planContent = output.slice(frontmatterMatch.index);

    // Find where the plan ends (next frontmatter or specific markers)
    // Look for a second occurrence of the frontmatter (duplicate)
    const secondFrontmatter = planContent.indexOf("---\nproject_id:", 10);
    if (secondFrontmatter > 0) {
      planContent = planContent.slice(0, secondFrontmatter);
    }

    // Also check for "Now I have" or similar phrases that indicate end of plan
    const endMarkers = [
      "Now I have",
      "Теперь у меня",
      "Let me generate",
      "Давай сгенерирую",
      "\n\n\n\n", // Multiple blank lines
    ];

    for (const marker of endMarkers) {
      const markerIndex = planContent.indexOf(marker);
      if (markerIndex > 100) { // Make sure we have some content first
        planContent = planContent.slice(0, markerIndex);
        break;
      }
    }

    return planContent.trim();
  }

  // If no frontmatter, try to find the # План разработки or # Project Plan header
  const headerMatch = output.match(/# (План разработки|Project Plan):/);
  if (headerMatch && headerMatch.index !== undefined) {
    let planContent = output.slice(headerMatch.index);

    // Check for duplicate headers
    const secondHeader = planContent.indexOf("# План разработки:", 10);
    const secondHeaderEn = planContent.indexOf("# Project Plan:", 10);
    const cutIndex = Math.min(
      secondHeader > 0 ? secondHeader : Infinity,
      secondHeaderEn > 0 ? secondHeaderEn : Infinity
    );

    if (cutIndex < Infinity) {
      planContent = planContent.slice(0, cutIndex);
    }

    // Add default frontmatter
    return `---
project_id: "unknown"
generated_at: "${new Date().toISOString()}"
updated_at: "${new Date().toISOString()}"
version: 1
status: "active"
---

${planContent.trim()}`;
  }

  // Return as-is if we can't find a recognizable format
  return output.trim();
}

/**
 * Parse analysis results from the plan markdown
 */
function parseAnalysisFromMarkdown(markdown: string): CodebaseAnalysisResult {
  const implemented: string[] = [];
  const missing: string[] = [];
  const technicalDebt: string[] = [];
  const risks: string[] = [];
  const suggestedTasks: CodebaseAnalysisResult["suggestedTasks"] = [];
  let notes = "";

  // Parse implemented features (lines starting with - [x])
  const implementedMatches = markdown.matchAll(/- \[x\] (.+)/gi);
  for (const match of implementedMatches) {
    implemented.push(match[1].trim());
  }

  // Parse missing/todo features (lines starting with - [ ])
  const todoMatches = markdown.matchAll(/- \[ \] (.+)/gi);
  for (const match of todoMatches) {
    const line = match[1].trim();
    missing.push(line);

    // Extract task info (supports both English and Russian)
    const priorityMatch = line.match(/(?:priority|приоритет):\s*(critical|high|medium|low|критический|высокий|средний|низкий)/i);
    let priorityStr = priorityMatch?.[1]?.toLowerCase() || "medium";
    // Map Russian priorities to English
    const priorityMap: Record<string, string> = {
      "критический": "critical",
      "высокий": "high",
      "средний": "medium",
      "низкий": "low",
    };
    priorityStr = priorityMap[priorityStr] || priorityStr;
    const priority = priorityStr as "critical" | "high" | "medium" | "low";

    // Determine task type based on content (supports Russian keywords)
    let type: "development" | "review" | "planning" | "maintenance" | "investigation" | "documentation" | "security" | "improvement" = "development";
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes("test") || lowerLine.includes("review") || lowerLine.includes("тест")) type = "review";
    else if (lowerLine.includes("doc") || lowerLine.includes("readme") || lowerLine.includes("документ")) type = "documentation";
    else if (lowerLine.includes("security") || lowerLine.includes("auth") || lowerLine.includes("безопасн") || lowerLine.includes("аутентиф")) type = "security";
    else if (lowerLine.includes("refactor") || lowerLine.includes("improve") || lowerLine.includes("рефакт") || lowerLine.includes("улучш")) type = "improvement";
    else if (lowerLine.includes("fix") || lowerLine.includes("bug") || lowerLine.includes("исправ") || lowerLine.includes("баг")) type = "maintenance";

    // Extract phase from section (supports both English and Russian headers)
    let phase = "MVP";
    const phase2Markers = ["### Phase 2", "### Фаза 2", "### Улучшения"];
    const phase3Markers = ["### Phase 3", "### Фаза 3", "### Полировка"];

    for (const marker of phase2Markers) {
      if (markdown.includes(marker) && markdown.indexOf(line) > markdown.indexOf(marker)) {
        phase = "Enhancement";
        break;
      }
    }
    for (const marker of phase3Markers) {
      if (markdown.includes(marker) && markdown.indexOf(line) > markdown.indexOf(marker)) {
        phase = "Polish";
        break;
      }
    }

    suggestedTasks.push({
      title: line
        .replace(/\s*[-—]\s*(?:priority|приоритет):\s*\w+/gi, "")
        .replace(/\s*[-—]\s*$/g, "")
        .trim(),
      description: line,
      priority,
      type,
      phase,
    });
  }

  // Parse technical debt section (supports Russian)
  const debtSection = markdown.match(/## (?:Technical Debt|Технический долг)\n([\s\S]*?)(?=\n## |$)/i);
  if (debtSection) {
    const debtLines = debtSection[1].match(/- (.+)/g);
    if (debtLines) {
      for (const line of debtLines) {
        technicalDebt.push(line.replace(/^- /, "").trim());
      }
    }
  }

  // Parse risks section (supports Russian)
  const risksSection = markdown.match(/## (?:Risks & Blockers|Риски и блокеры)\n([\s\S]*?)(?=\n## |$)/i);
  if (risksSection) {
    const riskLines = risksSection[1].match(/- (.+)/g);
    if (riskLines) {
      for (const line of riskLines) {
        risks.push(line.replace(/^- /, "").trim());
      }
    }
  }

  // Parse notes section (supports Russian)
  const notesSection = markdown.match(/## (?:Notes|Заметки)\n([\s\S]*?)(?=\n## |$)/i);
  if (notesSection) {
    notes = notesSection[1].trim();
  }

  return {
    implemented,
    missing,
    technicalDebt,
    risks,
    suggestedTasks,
    notes,
  };
}
