/**
 * Plan Repository
 * Handles storage and retrieval of project plans
 */
import type { ProjectPlan, AnalysisStatus, PlanVersion } from "../types.js";
import { BaseRepository } from "./base.repository.js";
export declare class PlanRepository extends BaseRepository<ProjectPlan> {
    protected readonly tableName = "project_plans";
    protected readonly cachePrefix = "pm:plan";
    protected readonly cacheTTL = 300;
    protected readonly pubsubChannel: "pm:events:analysis";
    private rowToPlan;
    private statusRowToStatus;
    /**
     * Get plan by project ID
     */
    getByProjectId(projectId: string): Promise<ProjectPlan | undefined>;
    /**
     * Get plan by ID
     */
    getById(id: string): Promise<ProjectPlan | undefined>;
    /**
     * Save or update a plan
     */
    upsert(plan: ProjectPlan): Promise<ProjectPlan>;
    /**
     * Update plan markdown only
     */
    updateMarkdown(projectId: string, markdown: string): Promise<ProjectPlan | undefined>;
    /**
     * Delete a plan
     */
    delete(projectId: string): Promise<boolean>;
    /**
     * Get all plans
     */
    getAll(): Promise<ProjectPlan[]>;
    /**
     * Get analysis status for a project
     */
    getAnalysisStatus(projectId: string): Promise<AnalysisStatus | undefined>;
    /**
     * Update analysis status
     */
    updateAnalysisStatus(status: AnalysisStatus): Promise<void>;
    /**
     * Reset analysis status to idle
     */
    resetAnalysisStatus(projectId: string): Promise<void>;
    /**
     * Get all running analyses
     */
    getRunningAnalyses(): Promise<AnalysisStatus[]>;
    private versionRowToVersion;
    /**
     * Archive the current plan version before updating
     */
    archiveCurrentVersion(planId: string, changeSummary?: string): Promise<void>;
    /**
     * Get all versions for a project
     */
    getVersions(projectId: string): Promise<PlanVersion[]>;
    /**
     * Get a specific version
     */
    getVersion(projectId: string, version: number): Promise<PlanVersion | undefined>;
    /**
     * Get all versions including current (for dropdown)
     */
    getAllVersionsWithCurrent(projectId: string): Promise<PlanVersion[]>;
}
//# sourceMappingURL=plan.repository.d.ts.map