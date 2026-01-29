import { execa, type ResultPromise } from "execa";
import { spawn } from "child_process";

export interface ClaudeCodeResult {
  success: boolean;
  output: string;
  exitCode?: number;
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
 */
export async function runClaudeCode(
  workDir: string,
  prompt: string,
  options?: {
    timeout?: number;
    allowEdits?: boolean;
  }
): Promise<ClaudeCodeResult> {
  const timeout = options?.timeout || 600000; // 10 minutes default

  try {
    // Build the command arguments
    // Using --print for non-interactive mode
    // Prompt will be passed via stdin
    const args = ["--print"];

    // If we want to allow edits (file modifications), use --dangerously-skip-permissions
    if (options?.allowEdits !== false) {
      args.push("--dangerously-skip-permissions");
    }

    console.log(`Running Claude Code in ${workDir} with timeout ${timeout}ms`);

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

    console.log("Claude Code completed successfully");

    return {
      success: true,
      output: result.stdout,
      exitCode: result.exitCode,
    };
  } catch (error) {
    if (error instanceof Error && "exitCode" in error) {
      const execaError = error as unknown as { exitCode: number; stderr?: string; stdout?: string; message: string };
      console.error("Claude Code failed:", execaError.message);
      return {
        success: false,
        output: execaError.stderr || execaError.stdout || execaError.message,
        exitCode: execaError.exitCode,
      };
    }

    console.error("Claude Code error:", error);
    return {
      success: false,
      output: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
 */
export async function isClaudeCodeAvailable(): Promise<boolean> {
  try {
    await execa("claude", ["--version"], { timeout: 5000 });
    return true;
  } catch {
    return false;
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
 */
export async function runClaudeCodeStreaming(
  workDir: string,
  prompt: string,
  onStep: StreamCallback,
  options?: {
    timeout?: number;
    allowEdits?: boolean;
  }
): Promise<ClaudeCodeResult> {
  const timeout = options?.timeout || 600000;

  return new Promise((resolve) => {
    // --verbose is required when using --output-format stream-json with --print
    const args = ["--print", "--verbose", "--output-format", "stream-json"];

    if (options?.allowEdits !== false) {
      args.push("--dangerously-skip-permissions");
    }

    console.log(`Running Claude Code (streaming) in ${workDir}`);
    console.log(`Args: ${args.join(" ")}`);

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

    // Manual timeout handler since spawn doesn't support timeout option
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        console.log(`Claude Code timed out after ${timeout}ms`);
        child.kill("SIGTERM");
        onStep({
          id: `step-${++stepCounter}`,
          type: "error",
          timestamp: Date.now(),
          content: `Timeout after ${timeout / 1000} seconds`,
          status: "failed",
        });
        isResolved = true;
        resolve({
          success: false,
          output: "Timeout: Claude Code did not respond in time",
        });
      }
    }, timeout);

    // Send prompt via stdin
    console.log(`Sending prompt (${prompt.length} chars) via stdin...`);
    child.stdin.write(prompt);
    child.stdin.end();

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
      console.error("Claude Code stderr:", errorText);
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

      console.log(`Claude Code process closed with code ${code}`);

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          const step = parseStreamEvent(event, ++stepCounter, currentToolId);
          if (step) onStep(step);
        } catch {
          // Ignore
        }
      }

      onStep({
        id: `step-${++stepCounter}`,
        type: "complete",
        timestamp: Date.now(),
        content: "Task completed",
        status: code === 0 ? "completed" : "failed",
      });

      resolve({
        success: code === 0,
        output: textContent || fullOutput,
        exitCode: code ?? undefined,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      if (isResolved) return;
      isResolved = true;

      console.error("Claude Code spawn error:", error);
      onStep({
        id: `step-${++stepCounter}`,
        type: "error",
        timestamp: Date.now(),
        content: error.message,
        status: "failed",
      });

      resolve({
        success: false,
        output: error.message,
      });
    });
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
