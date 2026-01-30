/**
 * Task Executor Service
 * Automatically executes approved tasks from backlog using Claude Code CLI
 */
import { execSync } from "child_process";
import { runClaudeCodeTask } from "../tools/claude-code.js";
export class TaskExecutorService {
    taskRepo;
    planTracker;
    constructor(taskRepo, planTracker) {
        this.taskRepo = taskRepo;
        this.planTracker = planTracker;
    }
    /**
     * Find and execute next approved backlog task
     * Returns true if task was executed, false if no task found
     */
    async executeNextTask() {
        // Find next executable task
        const task = await this.taskRepo.findNextExecutableTask();
        if (!task) {
            console.log("[TaskExecutor] No executable tasks found");
            return false;
        }
        console.log(`[TaskExecutor] Found task #${task.id}: ${task.title}`);
        // Mark as in_progress (status only - kanban_status stays as is until schema is updated)
        await this.taskRepo.updateStatus(task.id, {
            status: "in_progress"
        });
        try {
            // Execute task
            console.log(`[TaskExecutor] Executing task #${task.id}...`);
            const result = await this.executeTask(task);
            if (!result.success) {
                throw new Error(result.error || "Task execution failed");
            }
            // Create git commit
            console.log(`[TaskExecutor] Creating git commit for task #${task.id}...`);
            await this.commitTaskCompletion(task, result);
            // Update plan.md
            console.log(`[TaskExecutor] Updating plan.md for task #${task.id}...`);
            await this.planTracker.markTaskCompleted(task, result);
            // Mark as completed
            await this.taskRepo.updateStatus(task.id, { status: "completed", completedAt: Date.now() });
            console.log(`[TaskExecutor] ✅ Task #${task.id} completed successfully`);
            return true;
        }
        catch (error) {
            console.error(`[TaskExecutor] ❌ Task #${task.id} failed:`, error);
            // Mark as failed
            await this.taskRepo.updateStatus(task.id, { status: "failed" });
            throw error;
        }
    }
    /**
     * Execute task using Claude Code CLI
     */
    async executeTask(task) {
        const workDir = process.cwd();
        const prompt = this.buildTaskPrompt(task);
        try {
            const result = await runClaudeCodeTask(workDir, prompt, {
                projectName: task.projectId,
                techStack: undefined,
                features: undefined,
            });
            if (!result.success) {
                return {
                    success: false,
                    summary: "Task execution failed",
                    error: result.output,
                };
            }
            // Parse output to extract summary and files modified
            // Claude Code CLI output may contain structured information
            const summary = this.extractSummary(result.output);
            const filesModified = this.extractFilesModified(result.output);
            return {
                success: true,
                summary,
                filesModified,
            };
        }
        catch (error) {
            return {
                success: false,
                summary: "Task execution failed",
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Build comprehensive prompt for Claude Code CLI
     */
    buildTaskPrompt(task) {
        return `
Execute the following task:

# Task: ${task.title}

## Description
${task.description}

## Context
${task.context}

## Task Type
${task.type}

## Priority
${task.priority}

## Requirements
${task.suggestedActions.map((action, i) => `${i + 1}. ${action.description}`).join("\n")}

## Related Issues
${task.relatedIssues.length > 0 ? task.relatedIssues.join(", ") : "None"}

## Related PRs
${task.relatedPRs.length > 0 ? task.relatedPRs.join(", ") : "None"}

## Instructions
- Implement the requested functionality following best practices
- Write tests if applicable
- Update documentation if needed
- Follow existing code patterns and conventions
- Ensure code quality and maintainability

After completion, provide a summary of changes made and list all files that were modified.
`.trim();
    }
    /**
     * Create git commit for completed task
     */
    async commitTaskCompletion(task, result) {
        try {
            // Check if there are changes to commit
            const status = execSync("git status --porcelain", {
                cwd: process.cwd(),
                encoding: "utf-8",
            });
            if (!status.trim()) {
                console.log("[TaskExecutor] No changes to commit");
                return;
            }
            // Stage all changes
            execSync("git add .", { cwd: process.cwd() });
            // Build commit message
            const commitMessage = this.buildCommitMessage(task, result);
            // Create commit
            execSync(`git commit -m ${JSON.stringify(commitMessage)}`, {
                cwd: process.cwd(),
                encoding: "utf-8",
            });
            console.log(`[TaskExecutor] ✅ Git commit created for task #${task.id}`);
        }
        catch (error) {
            console.error("[TaskExecutor] Failed to create git commit:", error);
            throw new Error("Git commit failed");
        }
    }
    /**
     * Build structured git commit message
     */
    buildCommitMessage(task, result) {
        // Determine commit type prefix based on task type
        const commitTypeMap = {
            development: "feat",
            review: "refactor",
            planning: "docs",
            maintenance: "chore",
            investigation: "chore",
            notification: "chore",
            documentation: "docs",
            security: "fix",
            improvement: "refactor",
        };
        const commitType = commitTypeMap[task.type] || "chore";
        return `${commitType}(task-${task.id}): ${task.title}

${task.description}

Type: ${task.type}
Priority: ${task.priority}
Completed: ${new Date().toISOString()}

Changes:
${result.summary}

${result.filesModified && result.filesModified.length > 0
            ? `Files Modified: ${result.filesModified.join(", ")}`
            : ""}

Co-Authored-By: Claude Code CLI <noreply@anthropic.com>`;
    }
    /**
     * Extract summary from Claude Code CLI output
     */
    extractSummary(output) {
        // Look for summary markers in output
        const summaryMatch = output.match(/(?:summary|changes):\s*(.+?)(?:\n\n|$)/is);
        if (summaryMatch) {
            return summaryMatch[1].trim();
        }
        // Fallback: take last paragraph
        const paragraphs = output.split("\n\n").filter((p) => p.trim());
        return paragraphs[paragraphs.length - 1] || "Task completed successfully";
    }
    /**
     * Extract modified files from Claude Code CLI output
     */
    extractFilesModified(output) {
        const files = [];
        // Look for file paths in output (matches common patterns)
        const filePatterns = [
            /(?:modified|created|updated):\s*([^\s]+\.[a-z0-9]+)/gi,
            /(?:file|path):\s*([^\s]+\.[a-z0-9]+)/gi,
            /`([^`]+\.[a-z0-9]+)`/g,
        ];
        for (const pattern of filePatterns) {
            const matches = output.matchAll(pattern);
            for (const match of matches) {
                if (match[1]) {
                    files.push(match[1]);
                }
            }
        }
        // Remove duplicates
        return [...new Set(files)];
    }
}
//# sourceMappingURL=task-executor.service.js.map