export interface ClaudeCodeResult {
    success: boolean;
    output: string;
    exitCode?: number;
}
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
export type StreamCallback = (event: AgentStep) => void;
/**
 * Run Claude Code CLI with a prompt
 * Uses the --print flag for non-interactive execution
 * Passes prompt via stdin to avoid command line length issues
 */
export declare function runClaudeCode(workDir: string, prompt: string, options?: {
    timeout?: number;
    allowEdits?: boolean;
}): Promise<ClaudeCodeResult>;
/**
 * Run Claude Code with a complex multi-step task
 * Useful for project generation where multiple files need to be created
 */
export declare function runClaudeCodeTask(workDir: string, task: string, context?: {
    projectName?: string;
    techStack?: string[];
    features?: string[];
}): Promise<ClaudeCodeResult>;
/**
 * Generate a complete project structure using Claude Code
 */
export declare function generateProject(workDir: string, projectConfig: {
    name: string;
    description: string;
    techStack: string[];
    features: {
        name: string;
        description: string;
        priority: string;
    }[];
}): Promise<ClaudeCodeResult>;
/**
 * Check if Claude Code CLI is available
 */
export declare function isClaudeCodeAvailable(): Promise<boolean>;
/**
 * Run a general agent task using Claude Code CLI
 * Returns the response text
 */
export declare function runAgentTask(prompt: string, options?: {
    timeout?: number;
    allowCommands?: boolean;
}): Promise<{
    success: boolean;
    response: string;
    error?: string;
}>;
/**
 * Run Claude Code with streaming output and real-time event callbacks
 * Uses --output-format stream-json for detailed progress
 */
export declare function runClaudeCodeStreaming(workDir: string, prompt: string, onStep: StreamCallback, options?: {
    timeout?: number;
    allowEdits?: boolean;
}): Promise<ClaudeCodeResult>;
/**
 * Run agent task with streaming - broadcasts events in real-time
 */
export declare function runAgentTaskStreaming(prompt: string, onStep: StreamCallback, options?: {
    timeout?: number;
    allowCommands?: boolean;
}): Promise<{
    success: boolean;
    response: string;
    error?: string;
}>;
/**
 * Plan an idea using Claude Code CLI (uses subscription auth)
 * Returns structured plan as JSON
 */
export declare function planIdeaWithClaudeCode(idea: {
    title: string;
    description: string;
}): Promise<{
    success: boolean;
    plan?: {
        summary: string;
        techStack: string[];
        structure: {
            path: string;
            type: "file" | "directory";
            description: string;
        }[];
        features: {
            name: string;
            description: string;
            priority: "core" | "important" | "nice-to-have";
        }[];
        estimatedFiles: number;
        repoNameSuggestion: string;
    };
    error?: string;
}>;
//# sourceMappingURL=claude-code.d.ts.map