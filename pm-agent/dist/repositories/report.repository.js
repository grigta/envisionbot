/**
 * Analysis Report Repository
 */
import { BaseRepository } from "./base.repository.js";
export class ReportRepository extends BaseRepository {
    tableName = "analysis_reports";
    cachePrefix = "pm:report";
    cacheTTL = 600; // 10 minutes
    pubsubChannel = "pm:events:analysis";
    rowToReport(row, findings, projectReports) {
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
    findingRowToFinding(row) {
        return {
            severity: row.severity,
            category: row.category,
            title: row.title,
            description: row.description,
            projectId: row.project_id ?? "unknown",
        };
    }
    projectReportRowToProjectReport(row) {
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
    async getAll(limit = 20) {
        const cacheKey = `${this.cachePrefix}:list:${limit}`;
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare(`
      SELECT * FROM analysis_reports
      ORDER BY started_at DESC
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        const reports = await Promise.all(rows.map(async (row) => {
            const findings = await this.getFindings(row.id);
            const projectReports = await this.getProjectReports(row.id);
            return this.rowToReport(row, findings, projectReports);
        }));
        await this.setCache(cacheKey, reports, 120);
        return reports;
    }
    async getById(id) {
        const cacheKey = this.entityCacheKey(id);
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare("SELECT * FROM analysis_reports WHERE id = ?");
        const row = stmt.get(id);
        if (row) {
            const findings = await this.getFindings(id);
            const projectReports = await this.getProjectReports(id);
            const report = this.rowToReport(row, findings, projectReports);
            await this.setCache(cacheKey, report);
            return report;
        }
        return undefined;
    }
    async getFindings(reportId) {
        const stmt = this.db.prepare("SELECT * FROM report_findings WHERE report_id = ?");
        const rows = stmt.all(reportId);
        return rows.map((row) => this.findingRowToFinding(row));
    }
    async getProjectReports(reportId) {
        const stmt = this.db.prepare("SELECT * FROM project_reports WHERE report_id = ?");
        const rows = stmt.all(reportId);
        return rows.map((row) => this.projectReportRowToProjectReport(row));
    }
    async create(report) {
        this.transaction(() => {
            const reportStmt = this.db.prepare(`
        INSERT INTO analysis_reports (
          id, type, project_ids, started_at, completed_at, summary, generated_tasks
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
            reportStmt.run(report.id, report.type, JSON.stringify(report.projectIds), report.startedAt, report.completedAt ?? null, report.summary, JSON.stringify(report.generatedTasks));
            // Insert findings
            const findingStmt = this.db.prepare(`
        INSERT INTO report_findings (
          report_id, severity, category, title, description, project_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
            for (const finding of report.findings) {
                findingStmt.run(report.id, finding.severity, finding.category, finding.title, finding.description, finding.projectId !== "unknown" ? finding.projectId : null);
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
                    prStmt.run(report.id, pr.projectId, pr.projectName, pr.healthScore, pr.openIssues, pr.openPRs, pr.ciStatus, JSON.stringify(pr.risks));
                }
            }
        });
        // Clean up old reports (keep last 50)
        await this.cleanupOldReports(50);
        await this.invalidateCachePattern(`${this.cachePrefix}:*`);
        await this.publishEvent("analysis_completed", report);
        return report;
    }
    async update(id, updates) {
        const report = await this.getById(id);
        if (!report)
            return undefined;
        const stmt = this.db.prepare(`
      UPDATE analysis_reports
      SET completed_at = ?, summary = ?, generated_tasks = ?
      WHERE id = ?
    `);
        stmt.run(updates.completedAt ?? report.completedAt ?? null, updates.summary ?? report.summary, JSON.stringify(updates.generatedTasks ?? report.generatedTasks), id);
        const updatedReport = { ...report, ...updates };
        await this.invalidateCache(this.entityCacheKey(id), `${this.cachePrefix}:list:20`);
        return updatedReport;
    }
    async delete(id) {
        const stmt = this.db.prepare("DELETE FROM analysis_reports WHERE id = ?");
        const result = stmt.run(id);
        if (result.changes > 0) {
            await this.invalidateCachePattern(`${this.cachePrefix}:*`);
            return true;
        }
        return false;
    }
    async cleanupOldReports(keep) {
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
//# sourceMappingURL=report.repository.js.map