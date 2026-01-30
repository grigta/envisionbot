/**
 * Plan Tracker Service
 * Manages plan.md files for tracking task execution progress
 */
import type { Task } from "../types.js";
import type { TaskExecutionResult } from "./task-executor.service.js";
export declare class PlanTrackerService {
    private plansDir;
    constructor();
    /**
     * Mark task as completed in plan.md
     */
    markTaskCompleted(task: Task, result: TaskExecutionResult): Promise<void>;
    /**
     * Create initial plan file structure
     */
    private createInitialPlan;
    /**
     * Update plan with completed task entry
     */
    private updatePlanWithCompletion;
    /**
     * Build completion entry for task
     */
    private buildCompletionEntry;
    /**
     * Get plan file path for project
     */
    getPlanPath(projectId: string): string;
    /**
     * Check if plan exists for project
     */
    planExists(projectId: string): Promise<boolean>;
    /**
     * Get plan content for project
     */
    getPlanContent(projectId: string): Promise<string | null>;
}
//# sourceMappingURL=plan-tracker.service.d.ts.map