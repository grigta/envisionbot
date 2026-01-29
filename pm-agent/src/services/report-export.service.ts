/**
 * Report Export Service
 * Handles exporting analysis reports to PDF and Markdown formats
 */

import type { AnalysisReport, ProjectReport, Finding } from "../types.js";
import puppeteer from "puppeteer";

export class ReportExportService {
  /**
   * Export report to Markdown format
   */
  exportToMarkdown(report: AnalysisReport): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Analysis Report: ${this.formatType(report.type)}`);
    lines.push("");
    lines.push(`**Report ID**: ${report.id}`);
    lines.push(`**Started**: ${this.formatDate(report.startedAt)}`);
    if (report.completedAt) {
      lines.push(`**Completed**: ${this.formatDate(report.completedAt)}`);
    }
    lines.push(`**Projects**: ${report.projectIds.join(", ") || "None"}`);
    lines.push("");

    // Summary
    lines.push("## Summary");
    lines.push("");
    lines.push(report.summary);
    lines.push("");

    // Project Reports
    if (report.projectReports && report.projectReports.length > 0) {
      lines.push("## Project Status");
      lines.push("");

      for (const proj of report.projectReports) {
        lines.push(`### ${proj.projectName}`);
        lines.push("");
        lines.push(`- **Health Score**: ${proj.healthScore}/100`);
        lines.push(`- **CI Status**: ${proj.ciStatus}`);
        lines.push(`- **Open Issues**: ${proj.openIssues}`);
        lines.push(`- **Open PRs**: ${proj.openPRs}`);

        if (proj.risks && proj.risks.length > 0) {
          lines.push("");
          lines.push("**Risks**:");
          for (const risk of proj.risks) {
            lines.push(`- ⚠️ ${risk}`);
          }
        }
        lines.push("");
      }
    }

    // Findings
    if (report.findings.length > 0) {
      lines.push("## Findings");
      lines.push("");

      const groupedFindings = this.groupFindingsBySeverity(report.findings);

      for (const [severity, findings] of Object.entries(groupedFindings)) {
        if (findings.length === 0) continue;

        lines.push(`### ${this.capitalizeFirst(severity)} (${findings.length})`);
        lines.push("");

        for (const finding of findings) {
          lines.push(`#### ${finding.title}`);
          lines.push("");
          lines.push(`**Category**: ${finding.category}`);
          lines.push(`**Project**: ${finding.projectId}`);
          lines.push("");
          lines.push(finding.description);
          lines.push("");
        }
      }
    }

    // Generated Tasks
    if (report.generatedTasks.length > 0) {
      lines.push("## Generated Tasks");
      lines.push("");
      lines.push(`${report.generatedTasks.length} task(s) were generated from this analysis.`);
      lines.push("");
      lines.push("Task IDs:");
      for (const taskId of report.generatedTasks) {
        lines.push(`- ${taskId}`);
      }
      lines.push("");
    }

    // Footer
    lines.push("---");
    lines.push("");
    lines.push(`*Report generated on ${new Date().toLocaleString()}*`);

    return lines.join("\n");
  }

  /**
   * Export report to PDF format
   */
  async exportToPDF(report: AnalysisReport): Promise<Buffer> {
    // Generate HTML from the report
    const html = this.generateHTML(report);

    // Launch puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "20mm",
          right: "15mm",
          bottom: "20mm",
          left: "15mm",
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate HTML for PDF export
   */
  private generateHTML(report: AnalysisReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analysis Report - ${report.id}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      padding: 20px;
    }

    .header {
      border-bottom: 3px solid #0ea5e9;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    h1 {
      font-size: 28px;
      color: #0ea5e9;
      margin-bottom: 10px;
    }

    h2 {
      font-size: 22px;
      color: #0c4a6e;
      margin-top: 30px;
      margin-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }

    h3 {
      font-size: 18px;
      color: #1e40af;
      margin-top: 20px;
      margin-bottom: 10px;
    }

    h4 {
      font-size: 16px;
      color: #374151;
      margin-top: 15px;
      margin-bottom: 8px;
    }

    .metadata {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 15px;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .metadata dt {
      font-weight: 600;
      color: #374151;
    }

    .metadata dd {
      color: #6b7280;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-critical {
      background-color: #fee2e2;
      color: #991b1b;
    }

    .badge-error {
      background-color: #fef3c7;
      color: #92400e;
    }

    .badge-warning {
      background-color: #fef3c7;
      color: #92400e;
    }

    .badge-info {
      background-color: #dbeafe;
      color: #1e40af;
    }

    .badge-success {
      background-color: #d1fae5;
      color: #065f46;
    }

    .summary {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border-left: 4px solid #0ea5e9;
    }

    .project-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .project-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 12px;
      font-size: 14px;
      color: #6b7280;
    }

    .finding-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .finding-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .finding-description {
      color: #4b5563;
      font-size: 14px;
      line-height: 1.5;
    }

    .risk-list {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }

    .risk-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 14px;
      color: #92400e;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }

    ul, ol {
      margin-left: 20px;
      margin-bottom: 12px;
    }

    li {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Analysis Report: ${this.escapeHtml(this.formatType(report.type))}</h1>
    <dl class="metadata">
      <dt>Report ID:</dt>
      <dd>${this.escapeHtml(report.id)}</dd>
      <dt>Started:</dt>
      <dd>${this.escapeHtml(this.formatDate(report.startedAt))}</dd>
      ${
        report.completedAt
          ? `<dt>Completed:</dt><dd>${this.escapeHtml(this.formatDate(report.completedAt))}</dd>`
          : ""
      }
      <dt>Projects:</dt>
      <dd>${this.escapeHtml(report.projectIds.join(", ") || "None")}</dd>
    </dl>
  </div>

  <h2>Summary</h2>
  <div class="summary">
    ${this.escapeHtml(report.summary).replace(/\n/g, "<br>")}
  </div>

  ${this.generateProjectReportsHTML(report.projectReports)}
  ${this.generateFindingsHTML(report.findings)}
  ${this.generateTasksHTML(report.generatedTasks)}

  <div class="footer">
    <p>Report generated on ${new Date().toLocaleString()}</p>
    <p>Envision CEO - Autonomous Project Manager</p>
  </div>
</body>
</html>
    `.trim();
  }

  private generateProjectReportsHTML(projectReports?: ProjectReport[]): string {
    if (!projectReports || projectReports.length === 0) return "";

    const items = projectReports
      .map(
        (proj) => `
      <div class="project-card">
        <div class="project-header">
          <h3>${this.escapeHtml(proj.projectName)}</h3>
          <div>
            <span class="badge ${this.getHealthScoreBadgeClass(proj.healthScore)}">
              Health: ${proj.healthScore}/100
            </span>
          </div>
        </div>
        <div class="project-stats">
          <div><strong>CI Status:</strong> ${this.escapeHtml(proj.ciStatus)}</div>
          <div><strong>Open Issues:</strong> ${proj.openIssues}</div>
          <div><strong>Open PRs:</strong> ${proj.openPRs}</div>
        </div>
        ${
          proj.risks && proj.risks.length > 0
            ? `
          <div class="risk-list">
            <strong>Risks:</strong>
            ${proj.risks.map((risk) => `<div class="risk-item">⚠️ ${this.escapeHtml(risk)}</div>`).join("")}
          </div>
        `
            : ""
        }
      </div>
    `
      )
      .join("");

    return `<h2>Project Status</h2>${items}`;
  }

  private generateFindingsHTML(findings: Finding[]): string {
    if (findings.length === 0) return "";

    const groupedFindings = this.groupFindingsBySeverity(findings);
    let html = "<h2>Findings</h2>";

    for (const [severity, items] of Object.entries(groupedFindings)) {
      if (items.length === 0) continue;

      html += `<h3>${this.capitalizeFirst(severity)} (${items.length})</h3>`;

      for (const finding of items) {
        html += `
        <div class="finding-card">
          <div class="finding-header">
            <span class="badge badge-${severity}">${this.escapeHtml(severity)}</span>
            <h4>${this.escapeHtml(finding.title)}</h4>
          </div>
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            <strong>Category:</strong> ${this.escapeHtml(finding.category)} |
            <strong>Project:</strong> ${this.escapeHtml(finding.projectId)}
          </div>
          <div class="finding-description">
            ${this.escapeHtml(finding.description).replace(/\n/g, "<br>")}
          </div>
        </div>
      `;
      }
    }

    return html;
  }

  private generateTasksHTML(generatedTasks: string[]): string {
    if (generatedTasks.length === 0) return "";

    return `
      <h2>Generated Tasks</h2>
      <p>${generatedTasks.length} task(s) were generated from this analysis.</p>
      <ul>
        ${generatedTasks.map((taskId) => `<li>${this.escapeHtml(taskId)}</li>`).join("")}
      </ul>
    `;
  }

  private groupFindingsBySeverity(findings: Finding[]): Record<string, Finding[]> {
    return findings.reduce(
      (acc, finding) => {
        acc[finding.severity].push(finding);
        return acc;
      },
      { critical: [], error: [], warning: [], info: [] } as Record<string, Finding[]>
    );
  }

  private formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private formatType(type: string): string {
    const types: Record<string, string> = {
      health_check: "Health Check",
      deep_analysis: "Deep Analysis",
      manual: "Manual Analysis",
    };
    return types[type] || type;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  private getHealthScoreBadgeClass(score: number): string {
    if (score >= 80) return "badge-success";
    if (score >= 60) return "badge-info";
    if (score >= 40) return "badge-warning";
    return "badge-error";
  }
}
