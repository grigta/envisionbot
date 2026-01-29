/**
 * Project Analyzer Service
 * Orchestrates the entire project analysis workflow:
 * 1. Clone/update repository
 * 2. Analyze codebase with Claude Code
 * 3. Generate and store plan.md
 * 4. Sync tasks from plan
 * 5. Update plan on task completion
 */

import { randomUUID } from "node:crypto";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Project, Task, ProjectPlan, AnalysisStatus, CodebaseAnalysisResult } from "../types.js";
import { RepoManagerService, createRepoManager } from "./repo-manager.service.js";
import { PlanRepository } from "../repositories/plan.repository.js";
import { ProjectRepository } from "../repositories/project.repository.js";
import { TaskRepository } from "../repositories/task.repository.js";
import type { RepositoryDeps } from "../db/index.js";
import { analyzeProjectCodebase, type StreamCallback } from "../tools/claude-code.js";

export interface ProjectAnalyzerConfig {
  deps: RepositoryDeps;
  onProgress?: (status: AnalysisStatus) => void;
  onStep?: StreamCallback;
}

export class ProjectAnalyzerService {
  private readonly repoManager: RepoManagerService;
  private readonly planRepository: PlanRepository;
  private readonly projectRepository: ProjectRepository;
  private readonly taskRepository: TaskRepository;
  private readonly onProgress?: (status: AnalysisStatus) => void;
  private readonly onStep?: StreamCallback;

  constructor(config: ProjectAnalyzerConfig) {
    this.repoManager = createRepoManager();
    this.planRepository = new PlanRepository(config.deps);
    this.projectRepository = new ProjectRepository(config.deps);
    this.taskRepository = new TaskRepository(config.deps);
    this.onProgress = config.onProgress;
    this.onStep = config.onStep;
  }

  /**
   * Run full analysis on a project
   */
  async analyzeProject(projectId: string): Promise<{
    success: boolean;
    plan?: ProjectPlan;
    tasksCreated?: number;
    error?: string;
  }> {
    const project = await this.projectRepository.getById(projectId);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    try {
      // Step 1: Clone or update repository
      await this.updateStatus(projectId, "cloning", 10, "Cloning repository...");

      const cloneResult = await this.repoManager.cloneOrUpdate(
        projectId,
        project.repo,
        (step, progress) => {
          this.updateStatus(projectId, "cloning", progress, step);
        }
      );

      if (!cloneResult.success) {
        await this.updateStatus(projectId, "failed", 0, undefined, cloneResult.error);
        return { success: false, error: cloneResult.error };
      }

      // Update project with local path
      await this.projectRepository.upsert({
        ...project,
        updatedAt: Date.now(),
      });

      // Step 2: Analyze codebase with Claude Code
      await this.updateStatus(projectId, "analyzing", 50, "Analyzing codebase...");

      // Get previous plan for context
      const previousPlan = await this.planRepository.getByProjectId(projectId);

      const analysisResult = await analyzeProjectCodebase(
        cloneResult.localPath,
        { name: project.name, repo: project.repo, phase: project.phase },
        this.onStep,
        previousPlan // Pass previous plan for context
      );

      if (!analysisResult.success || !analysisResult.planMarkdown) {
        await this.updateStatus(projectId, "failed", 0, undefined, analysisResult.error);
        return { success: false, error: analysisResult.error };
      }

      // Step 3: Save plan to database and file
      await this.updateStatus(projectId, "generating", 70, "Saving plan...");

      const plan = await this.savePlan(projectId, analysisResult.planMarkdown, analysisResult.analysis);

      // Also save plan.md file in project directory
      const planFilePath = join(this.repoManager.getProjectPath(projectId), "plan.md");
      writeFileSync(planFilePath, analysisResult.planMarkdown);

      // Step 4: Sync tasks from plan
      await this.updateStatus(projectId, "syncing", 85, "Creating tasks from plan...");

      const tasksCreated = await this.syncTasksFromPlan(projectId, analysisResult.analysis);

      // Update project last analysis time
      await this.projectRepository.upsert({
        ...project,
        updatedAt: Date.now(),
      });

      // Mark as completed
      await this.updateStatus(projectId, "completed", 100, "Analysis complete");

      return {
        success: true,
        plan,
        tasksCreated,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.updateStatus(projectId, "failed", 0, undefined, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Save plan to database
   * Archives the current version before creating a new one
   */
  private async savePlan(
    projectId: string,
    markdown: string,
    analysis?: CodebaseAnalysisResult
  ): Promise<ProjectPlan> {
    const now = Date.now();
    const existingPlan = await this.planRepository.getByProjectId(projectId);

    // Archive current version before updating
    if (existingPlan) {
      const changeSummary = analysis
        ? `Implemented: ${analysis.implemented.length}, Missing: ${analysis.missing.length}, New tasks: ${analysis.suggestedTasks.length}`
        : undefined;
      await this.planRepository.archiveCurrentVersion(existingPlan.id, changeSummary);
    }

    const plan: ProjectPlan = {
      id: existingPlan?.id || randomUUID(),
      projectId,
      markdown,
      version: (existingPlan?.version || 0) + 1,
      generatedAt: existingPlan?.generatedAt || now,
      updatedAt: now,
      analysisSummary: analysis
        ? `Реализовано: ${analysis.implemented.length}, Не реализовано: ${analysis.missing.length}, Тех. долг: ${analysis.technicalDebt.length}`
        : undefined,
    };

    return this.planRepository.upsert(plan);
  }

  /**
   * Sync tasks from analysis to task repository
   */
  private async syncTasksFromPlan(
    projectId: string,
    analysis?: CodebaseAnalysisResult
  ): Promise<number> {
    if (!analysis?.suggestedTasks?.length) {
      return 0;
    }

    let created = 0;
    const now = Date.now();

    for (const suggestedTask of analysis.suggestedTasks) {
      // Check if similar task already exists
      const existingTasks = await this.taskRepository.getByProjectId(projectId);
      const isDuplicate = existingTasks.some(
        (t) => t.title.toLowerCase() === suggestedTask.title.toLowerCase()
      );

      if (isDuplicate) {
        continue;
      }

      const task: Task = {
        id: randomUUID(),
        projectId,
        type: suggestedTask.type,
        priority: suggestedTask.priority,
        title: suggestedTask.title,
        description: suggestedTask.description,
        context: `Generated from plan analysis. Phase: ${suggestedTask.phase || "Unknown"}`,
        suggestedActions: [],
        relatedIssues: [],
        relatedPRs: [],
        status: "pending",
        kanbanStatus: "not_started",
        generatedAt: now,
        generatedBy: "plan_sync" as const,
      };

      await this.taskRepository.upsert(task);
      created++;
    }

    return created;
  }

  /**
   * Update plan when a task is completed
   */
  async updatePlanOnTaskComplete(taskId: string): Promise<void> {
    const task = await this.taskRepository.getById(taskId);
    if (!task) return;

    const plan = await this.planRepository.getByProjectId(task.projectId);
    if (!plan) return;

    // Update the markdown to mark the task as completed
    let updatedMarkdown = plan.markdown;

    // Try to find and update the task in the markdown
    // Look for patterns like "- [ ] Task title" and change to "- [x] Task title"
    const taskTitleEscaped = task.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const todoPattern = new RegExp(`- \\[ \\] (${taskTitleEscaped}[^\\n]*)`, "i");
    const match = updatedMarkdown.match(todoPattern);

    if (match) {
      updatedMarkdown = updatedMarkdown.replace(
        todoPattern,
        `- [x] ${match[1]} (completed: ${new Date().toISOString().split("T")[0]})`
      );

      await this.planRepository.updateMarkdown(task.projectId, updatedMarkdown);

      // Also update the file
      const planFilePath = join(this.repoManager.getProjectPath(task.projectId), "plan.md");
      if (existsSync(planFilePath)) {
        writeFileSync(planFilePath, updatedMarkdown);
      }
    }
  }

  /**
   * Get current analysis status
   */
  async getAnalysisStatus(projectId: string): Promise<AnalysisStatus | undefined> {
    return this.planRepository.getAnalysisStatus(projectId);
  }

  /**
   * Get plan for a project
   */
  async getPlan(projectId: string): Promise<ProjectPlan | undefined> {
    return this.planRepository.getByProjectId(projectId);
  }

  /**
   * Get all plan versions including current
   */
  async getPlanVersions(projectId: string): Promise<import("../types.js").PlanVersion[]> {
    return this.planRepository.getAllVersionsWithCurrent(projectId);
  }

  /**
   * Get specific plan version
   */
  async getPlanVersion(projectId: string, version: number): Promise<import("../types.js").PlanVersion | undefined> {
    return this.planRepository.getVersion(projectId, version);
  }

  /**
   * Update plan markdown manually
   */
  async updatePlanMarkdown(projectId: string, markdown: string): Promise<ProjectPlan | undefined> {
    const updated = await this.planRepository.updateMarkdown(projectId, markdown);

    // Also update the file
    if (updated) {
      const planFilePath = join(this.repoManager.getProjectPath(projectId), "plan.md");
      if (existsSync(planFilePath)) {
        writeFileSync(planFilePath, markdown);
      }
    }

    return updated;
  }

  /**
   * Helper to update status
   */
  private async updateStatus(
    projectId: string,
    status: AnalysisStatus["status"],
    progress: number,
    currentStep?: string,
    error?: string
  ): Promise<void> {
    const analysisStatus: AnalysisStatus = {
      projectId,
      status,
      progress,
      currentStep,
      error,
      startedAt: status === "cloning" ? Date.now() : undefined,
      completedAt: status === "completed" || status === "failed" ? Date.now() : undefined,
    };

    await this.planRepository.updateAnalysisStatus(analysisStatus);

    if (this.onProgress) {
      this.onProgress(analysisStatus);
    }
  }
}

/**
 * Create ProjectAnalyzerService instance
 */
export function createProjectAnalyzer(
  deps: RepositoryDeps,
  options?: {
    onProgress?: (status: AnalysisStatus) => void;
    onStep?: StreamCallback;
  }
): ProjectAnalyzerService {
  return new ProjectAnalyzerService({
    deps,
    onProgress: options?.onProgress,
    onStep: options?.onStep,
  });
}
