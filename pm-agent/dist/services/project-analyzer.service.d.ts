/**
 * Project Analyzer Service
 * Orchestrates the entire project analysis workflow:
 * 1. Clone/update repository
 * 2. Analyze codebase with Claude Code
 * 3. Generate and store plan.md
 * 4. Sync tasks from plan
 * 5. Update plan on task completion
 */
import type { ProjectPlan, AnalysisStatus } from "../types.js";
import type { RepositoryDeps } from "../db/index.js";
import { type StreamCallback } from "../tools/claude-code.js";
export interface ProjectAnalyzerConfig {
    deps: RepositoryDeps;
    onProgress?: (status: AnalysisStatus) => void;
    onStep?: StreamCallback;
}
export declare class ProjectAnalyzerService {
    private readonly repoManager;
    private readonly planRepository;
    private readonly projectRepository;
    private readonly taskRepository;
    private readonly onProgress?;
    private readonly onStep?;
    constructor(config: ProjectAnalyzerConfig);
    /**
     * Run full analysis on a project
     */
    analyzeProject(projectId: string): Promise<{
        success: boolean;
        plan?: ProjectPlan;
        tasksCreated?: number;
        error?: string;
    }>;
    /**
     * Save plan to database
     * Archives the current version before creating a new one
     */
    private savePlan;
    /**
     * Sync tasks from analysis to task repository
     */
    private syncTasksFromPlan;
    /**
     * Update plan when a task is completed
     */
    updatePlanOnTaskComplete(taskId: string): Promise<void>;
    /**
     * Get current analysis status
     */
    getAnalysisStatus(projectId: string): Promise<AnalysisStatus | undefined>;
    /**
     * Get plan for a project
     */
    getPlan(projectId: string): Promise<ProjectPlan | undefined>;
    /**
     * Get all plan versions including current
     */
    getPlanVersions(projectId: string): Promise<import("../types.js").PlanVersion[]>;
    /**
     * Get specific plan version
     */
    getPlanVersion(projectId: string, version: number): Promise<import("../types.js").PlanVersion | undefined>;
    /**
     * Update plan markdown manually
     */
    updatePlanMarkdown(projectId: string, markdown: string): Promise<ProjectPlan | undefined>;
    /**
     * Helper to update status
     */
    private updateStatus;
}
/**
 * Create ProjectAnalyzerService instance
 */
export declare function createProjectAnalyzer(deps: RepositoryDeps, options?: {
    onProgress?: (status: AnalysisStatus) => void;
    onStep?: StreamCallback;
}): ProjectAnalyzerService;
//# sourceMappingURL=project-analyzer.service.d.ts.map