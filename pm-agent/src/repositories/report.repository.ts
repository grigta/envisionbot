/**
 * Analysis Report Repository
 */

import type { AnalysisReport, Finding, ProjectReport } from "../types.js";
import { BaseRepository, type RepositoryDeps } from "./base.repository.js";

interface ReportRow {
  id: string;
  type: AnalysisReport["type"];
  project_ids: string;
  started_at: number;
  completed_at: number | null;
  summary: string;
  generated_tasks: string;
}

interface FindingRow {
  id: number;
  report_id: string;
  severity: Finding["severity"];
  category: string;
  title: string;
  description: string;
  project_id: string | null;
}

interface ProjectReportRow {
  id: number;
  report_id: string;
  project_id: string;
  project_name: string;
  health_score: number;
  open_issues: number;
  open_prs: number;
  ci_status: ProjectReport["ciStatus"];
  risks: string;
}

export class ReportRepository extends BaseRepository<AnalysisReport> {
  protected readonly tableName = "analysis_reports";
  protected readonly cachePrefix = "pm:report";
  protected readonly cacheTTL = 600; // 10 minutes
  protected readonly pubsubChannel = "pm:events:analysis" as const;

  private rowToReport(
    row: ReportRow,
    findings: Finding[],
    projectReports: ProjectReport[]
  ): AnalysisReport {
    return {
      id: row.id,
      type: row.type,
      projectIds: JSON.parse(row.project_ids),
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      summary: row.summary,
      findings,
      generatedTasks: JSON.parse(row.generated_tasks),
      projectReports: projectReports.length > 0 ? projectReports : undefined,
    };
  }

  private findingRowToFinding(row: FindingRow): Finding {
    return {
      severity: row.severity,
      category: row.category,
      title: row.title,
      description: row.description,
      projectId: row.project_id ?? "unknown",
    };
  }

  private projectReportRowToProjectReport(row: ProjectReportRow): ProjectReport {
    return {
      projectId: row.project_id,
      projectName: row.project_name,
      healthScore: row.health_score,
      openIssues: row.open_issues,
      openPRs: row.open_prs,
      ciStatus: row.ci_status,
      risks: JSON.parse(row.risks),
    };
  }

  async getAll(limit = 20): Promise<AnalysisReport[]> {
    const cacheKey = `${this.cachePrefix}:list:${limit}`;
    const cached = await this.getFromCache<AnalysisReport[]>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare(`
      SELECT * FROM analysis_reports
      ORDER BY started_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as ReportRow[];

    const reports = await Promise.all(
      rows.map(async (row) => {
        const findings = await this.getFindings(row.id);
        const projectReports = await this.getProjectReports(row.id);
        return this.rowToReport(row, findings, projectReports);
      })
    );

    await this.setCache(cacheKey, reports, 120);
    return reports;
  }

  async getById(id: string): Promise<AnalysisReport | undefined> {
    const cacheKey = this.entityCacheKey(id);
    const cached = await this.getFromCache<AnalysisReport>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare("SELECT * FROM analysis_reports WHERE id = ?");
    const row = stmt.get(id) as ReportRow | undefined;

    if (row) {
      const findings = await this.getFindings(id);
      const projectReports = await this.getProjectReports(id);
      const report = this.rowToReport(row, findings, projectReports);
      await this.setCache(cacheKey, report);
      return report;
    }

    return undefined;
  }

  private async getFindings(reportId: string): Promise<Finding[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM report_findings WHERE report_id = ?"
    );
    const rows = stmt.all(reportId) as FindingRow[];
    return rows.map((row) => this.findingRowToFinding(row));
  }

  private async getProjectReports(reportId: string): Promise<ProjectReport[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM project_reports WHERE report_id = ?"
    );
    const rows = stmt.all(reportId) as ProjectReportRow[];
    return rows.map((row) => this.projectReportRowToProjectReport(row));
  }

  async create(report: AnalysisReport): Promise<AnalysisReport> {
    this.transaction(() => {
      const reportStmt = this.db.prepare(`
        INSERT INTO analysis_reports (
          id, type, project_ids, started_at, completed_at, summary, generated_tasks
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      reportStmt.run(
        report.id,
        report.type,
        JSON.stringify(report.projectIds),
        report.startedAt,
        report.completedAt ?? null,
        report.summary,
        JSON.stringify(report.generatedTasks)
      );

      // Insert findings
      const findingStmt = this.db.prepare(`
        INSERT INTO report_findings (
          report_id, severity, category, title, description, project_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const finding of report.findings) {
        findingStmt.run(
          report.id,
          finding.severity,
          finding.category,
          finding.title,
          finding.description,
          finding.projectId !== "unknown" ? finding.projectId : null
        );
      }

      // Insert project reports
      if (report.projectReports) {
        const prStmt = this.db.prepare(`
          INSERT INTO project_reports (
            report_id, project_id, project_name, health_score,
            open_issues, open_prs, ci_status, risks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const pr of report.projectReports) {
          prStmt.run(
            report.id,
            pr.projectId,
            pr.projectName,
            pr.healthScore,
            pr.openIssues,
            pr.openPRs,
            pr.ciStatus,
            JSON.stringify(pr.risks)
          );
        }
      }
    });

    // Clean up old reports (keep last 50)
    await this.cleanupOldReports(50);

    await this.invalidateCachePattern(`${this.cachePrefix}:*`);
    await this.publishEvent("analysis_completed", report);

    return report;
  }

  async update(id: string, updates: Partial<AnalysisReport>): Promise<AnalysisReport | undefined> {
    const report = await this.getById(id);
    if (!report) return undefined;

    const stmt = this.db.prepare(`
      UPDATE analysis_reports
      SET completed_at = ?, summary = ?, generated_tasks = ?
      WHERE id = ?
    `);

    stmt.run(
      updates.completedAt ?? report.completedAt ?? null,
      updates.summary ?? report.summary,
      JSON.stringify(updates.generatedTasks ?? report.generatedTasks),
      id
    );

    const updatedReport = { ...report, ...updates };

    await this.invalidateCache(
      this.entityCacheKey(id),
      `${this.cachePrefix}:list:20`
    );

    return updatedReport;
  }

  async delete(id: string): Promise<boolean> {
    const stmt = this.db.prepare("DELETE FROM analysis_reports WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes > 0) {
      await this.invalidateCachePattern(`${this.cachePrefix}:*`);
      return true;
    }

    return false;
  }

  private async cleanupOldReports(keep: number): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM analysis_reports
      WHERE id NOT IN (
        SELECT id FROM analysis_reports
        ORDER BY started_at DESC
        LIMIT ?
      )
    `);
    stmt.run(keep);
  }
}
