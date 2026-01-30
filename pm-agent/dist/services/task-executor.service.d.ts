/**
 * Task Executor Service
 * Automatically executes approved tasks from backlog using Claude Code CLI
 */
import { TaskRepository } from "../repositories/task.repository.js";
import { PlanTrackerService } from "./plan-tracker.service.js";
export interface TaskExecutionResult {
    success: boolean;
    summary: string;
    filesModified?: string[];
    error?: string;
}
export declare class TaskExecutorService {
    private taskRepo;
    private planTracker;
    constructor(taskRepo: TaskRepository, planTracker: PlanTrackerService);
    /**
     * Find and execute next approved backlog task
     * Returns true if task was executed, false if no task found
     */
    executeNextTask(): Promise<boolean>;
    /**
     * Execute task using Claude Code CLI
     */
    private executeTask;
    /**
     * Build comprehensive prompt for Claude Code CLI
     */
    private buildTaskPrompt;
    /**
     * Create git commit for completed task
     */
    private commitTaskCompletion;
    /**
     * Build structured git commit message
     */
    private buildCommitMessage;
    /**
     * Extract summary from Claude Code CLI output
     */
    private extractSummary;
    /**
     * Extract modified files from Claude Code CLI output
     */
    private extractFilesModified;
}
//# sourceMappingURL=task-executor.service.d.ts.map