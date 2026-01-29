import type { ToolDefinition, ToolResult } from "../types.js";
export declare const githubTools: ToolDefinition[];
export declare function executeGitHubTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult>;
export declare function executeApprovedAction(actionType: string, payload: Record<string, unknown>): Promise<ToolResult>;
//# sourceMappingURL=github.d.ts.map