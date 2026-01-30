/**
 * Project Metrics Repository
 */
import type { ProjectMetrics } from "../types.js";
import { BaseRepository } from "./base.repository.js";
export declare class MetricsRepository extends BaseRepository<ProjectMetrics> {
    protected readonly tableName = "project_metrics";
    protected readonly cachePrefix = "pm:metrics";
    protected readonly cacheTTL = 120;
    protected readonly pubsubChannel: "pm:events:analysis";
    private rowToMetrics;
    getByProjectId(projectId: string, limit?: number): Promise<ProjectMetrics[]>;
    getLatest(projectId: string): Promise<ProjectMetrics | undefined>;
    create(metrics: ProjectMetrics): Promise<ProjectMetrics>;
    private cleanupOldMetrics;
}
//# sourceMappingURL=metrics.repository.d.ts.map