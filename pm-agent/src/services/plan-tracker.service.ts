/**
 * Plan Tracker Service
 * Manages plan.md files for tracking task execution progress
 */

import { promises as fs } from "fs";
import { join } from "path";
import type { Task } from "../types.js";
import type { TaskExecutionResult } from "./task-executor.service.js";

export class PlanTrackerService {
  private plansDir: string;

  constructor() {
    this.plansDir = join(process.cwd(), "data", "plans");
  }

  /**
   * Mark task as completed in plan.md
   */
  async markTaskCompleted(
    task: Task,
    result: TaskExecutionResult
  ): Promise<void> {
    const planPath = join(this.plansDir, `project-${task.projectId}.md`);

    // Ensure plans directory exists
    await fs.mkdir(this.plansDir, { recursive: true });

    // Read or create plan file
    let content = "";
    try {
      content = await fs.readFile(planPath, "utf-8");
    } catch (error) {
      // File doesn't exist, create initial plan
      content = this.createInitialPlan(task.projectId);
    }

    // Update plan with completed task
    content = this.updatePlanWithCompletion(content, task, result);

    // Write back
    await fs.writeFile(planPath, content, "utf-8");

    console.log(`[PlanTracker] ✅ Plan updated: ${planPath}`);
  }

  /**
   * Create initial plan file structure
   */
  private createInitialPlan(projectId: string): string {
    return `# Project Execution Plan

Project ID: ${projectId}
Generated: ${new Date().toISOString()}

## Completed Tasks

## In Progress

## Backlog

`;
  }

  /**
   * Update plan with completed task entry
   */
  private updatePlanWithCompletion(
    content: string,
    task: Task,
    result: TaskExecutionResult
  ): string {
    const completionEntry = this.buildCompletionEntry(task, result);

    // Insert at the top of "Completed Tasks" section
    const completedTasksMarker = "## Completed Tasks";

    if (content.includes(completedTasksMarker)) {
      // Insert after "## Completed Tasks" header
      return content.replace(
        completedTasksMarker,
        `${completedTasksMarker}\n${completionEntry}`
      );
    } else {
      // Add "Completed Tasks" section if it doesn't exist
      return `${content}\n\n## Completed Tasks\n${completionEntry}`;
    }
  }

  /**
   * Build completion entry for task
   */
  private buildCompletionEntry(
    task: Task,
    result: TaskExecutionResult
  ): string {
    const filesSection =
      result.filesModified && result.filesModified.length > 0
        ? `**Files Modified**: ${result.filesModified.join(", ")}`
        : "";

    return `
### ✅ ${task.title} (Task #${task.id})

**Completed**: ${new Date().toISOString()}
**Type**: ${task.type}
**Priority**: ${task.priority}

**Description**: ${task.description}

**Changes**:
${result.summary}

${filesSection}

---
`;
  }

  /**
   * Get plan file path for project
   */
  getPlanPath(projectId: string): string {
    return join(this.plansDir, `project-${projectId}.md`);
  }

  /**
   * Check if plan exists for project
   */
  async planExists(projectId: string): Promise<boolean> {
    try {
      await fs.access(this.getPlanPath(projectId));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get plan content for project
   */
  async getPlanContent(projectId: string): Promise<string | null> {
    try {
      return await fs.readFile(this.getPlanPath(projectId), "utf-8");
    } catch {
      return null;
    }
  }
}
