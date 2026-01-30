/**
 * Analysis Report Repository
 */
import type { AnalysisReport } from "../types.js";
import { BaseRepository } from "./base.repository.js";
export declare class ReportRepository extends BaseRepository<AnalysisReport> {
    protected readonly tableName = "analysis_reports";
    protected readonly cachePrefix = "pm:report";
    protected readonly cacheTTL = 600;
    protected readonly pubsubChannel: "pm:events:analysis";
    private rowToReport;
    private findingRowToFinding;
    private projectReportRowToProjectReport;
    getAll(limit?: number): Promise<AnalysisReport[]>;
    getById(id: string): Promise<AnalysisReport | undefined>;
    private getFindings;
    private getProjectReports;
    create(report: AnalysisReport): Promise<AnalysisReport>;
    update(id: string, updates: Partial<AnalysisReport>): Promise<AnalysisReport | undefined>;
    delete(id: string): Promise<boolean>;
    private cleanupOldReports;
}
//# sourceMappingURL=report.repository.d.ts.map