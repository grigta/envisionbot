/**
 * Report Export Service Tests
 */

import { describe, it, expect } from "vitest";
import { ReportExportService } from "./report-export.service.js";
import type { AnalysisReport } from "../types.js";

describe("ReportExportService", () => {
  const mockReport: AnalysisReport = {
    id: "test-report-123",
    type: "health_check",
    projectIds: ["proj-1", "proj-2"],
    startedAt: Date.now(),
    completedAt: Date.now() + 60000,
    summary: "Test report summary with important findings.",
    findings: [
      {
        severity: "critical",
        category: "Security",
        title: "Critical security vulnerability",
        description: "A critical security issue was found in the authentication module.",
        projectId: "proj-1",
      },
      {
        severity: "warning",
        category: "Performance",
        title: "Slow database query",
        description: "Database query in user service takes over 2 seconds.",
        projectId: "proj-2",
      },
      {
        severity: "info",
        category: "Code Quality",
        title: "Code duplication detected",
        description: "Similar code patterns found across multiple files.",
        projectId: "proj-1",
      },
    ],
    generatedTasks: ["task-1", "task-2", "task-3"],
    projectReports: [
      {
        projectId: "proj-1",
        projectName: "Test Project 1",
        healthScore: 85,
        openIssues: 5,
        openPRs: 2,
        ciStatus: "passing",
        risks: ["High code complexity", "Missing tests"],
      },
      {
        projectId: "proj-2",
        projectName: "Test Project 2",
        healthScore: 72,
        openIssues: 12,
        openPRs: 4,
        ciStatus: "failing",
        risks: ["CI failures", "Outdated dependencies"],
      },
    ],
  };

  describe("exportToMarkdown", () => {
    it("should export report to markdown format", async () => {
      const markdown = await ReportExportService.exportToMarkdown(mockReport);

      expect(markdown).toBeTruthy();
      expect(markdown).toContain("# Analysis Report: HEALTH CHECK");
      expect(markdown).toContain("**Report ID:** test-report-123");
      expect(markdown).toContain("## Summary");
      expect(markdown).toContain("Test report summary with important findings.");
    });

    it("should include project reports in markdown", async () => {
      const markdown = await ReportExportService.exportToMarkdown(mockReport);

      expect(markdown).toContain("## Project Reports");
      expect(markdown).toContain("### Test Project 1");
      expect(markdown).toContain("**Health Score:** 85/100");
      expect(markdown).toContain("### Test Project 2");
      expect(markdown).toContain("**Health Score:** 72/100");
    });

    it("should group findings by severity in markdown", async () => {
      const markdown = await ReportExportService.exportToMarkdown(mockReport);

      expect(markdown).toContain("## Findings");
      expect(markdown).toContain("### CRITICAL (1)");
      expect(markdown).toContain("### WARNING (1)");
      expect(markdown).toContain("### INFO (1)");
      expect(markdown).toContain("Critical security vulnerability");
      expect(markdown).toContain("Slow database query");
      expect(markdown).toContain("Code duplication detected");
    });

    it("should include generated tasks in markdown", async () => {
      const markdown = await ReportExportService.exportToMarkdown(mockReport);

      expect(markdown).toContain("## Generated Tasks");
      expect(markdown).toContain("This analysis generated **3** tasks.");
      expect(markdown).toContain("- task-1");
      expect(markdown).toContain("- task-2");
      expect(markdown).toContain("- task-3");
    });

    it("should handle report without project reports", async () => {
      const reportWithoutProjects = { ...mockReport, projectReports: undefined };
      const markdown = await ReportExportService.exportToMarkdown(reportWithoutProjects);

      expect(markdown).toBeTruthy();
      expect(markdown).not.toContain("## Project Reports");
    });

    it("should handle report without findings", async () => {
      const reportWithoutFindings = { ...mockReport, findings: [] };
      const markdown = await ReportExportService.exportToMarkdown(reportWithoutFindings);

      expect(markdown).toBeTruthy();
      expect(markdown).not.toContain("## Findings");
    });
  });

  describe("exportToPDF", () => {
    it("should export report to PDF buffer", async () => {
      const pdfBuffer = await ReportExportService.exportToPDF(mockReport);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      // PDF files start with %PDF
      expect(pdfBuffer.toString("utf8", 0, 4)).toBe("%PDF");
    });
  });
});
