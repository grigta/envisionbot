/**
 * Tests for Report Export Service
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ReportExportService } from "./report-export.service.js";
import type { AnalysisReport, Finding, ProjectReport } from "../types.js";

describe("ReportExportService", () => {
  let service: ReportExportService;
  let mockReport: AnalysisReport;

  beforeEach(() => {
    service = new ReportExportService();

    // Create a comprehensive mock report for testing
    mockReport = {
      id: "test-report-123",
      type: "health_check",
      projectIds: ["project-1", "project-2"],
      startedAt: Date.now() - 3600000, // 1 hour ago
      completedAt: Date.now(),
      summary: "Overall project health is good. Found 3 critical issues that need immediate attention.",
      findings: [
        {
          severity: "critical",
          category: "Security",
          title: "Critical SQL Injection Vulnerability",
          description: "Found SQL injection vulnerability in user input handling. This needs immediate patching.",
          projectId: "project-1",
        },
        {
          severity: "error",
          category: "CI/CD",
          title: "Build Failing on Main Branch",
          description: "The main branch build has been failing for 2 days due to dependency conflicts.",
          projectId: "project-1",
        },
        {
          severity: "warning",
          category: "Performance",
          title: "Slow API Response Times",
          description: "API endpoints are responding 30% slower than baseline.",
          projectId: "project-2",
        },
        {
          severity: "info",
          category: "Dependencies",
          title: "Minor Updates Available",
          description: "3 dependencies have minor updates available.",
          projectId: "project-2",
        },
      ],
      generatedTasks: ["task-1", "task-2", "task-3"],
      projectReports: [
        {
          projectId: "project-1",
          projectName: "Main Application",
          healthScore: 65,
          openIssues: 12,
          openPRs: 3,
          ciStatus: "failing",
          risks: ["Build failures", "Security vulnerabilities"],
        },
        {
          projectId: "project-2",
          projectName: "API Service",
          healthScore: 82,
          openIssues: 5,
          openPRs: 2,
          ciStatus: "passing",
          risks: ["Performance degradation"],
        },
      ],
    };
  });

  describe("exportToMarkdown", () => {
    it("should generate valid markdown with all sections", () => {
      const markdown = service.exportToMarkdown(mockReport);

      expect(markdown).toContain("# Analysis Report: Health Check");
      expect(markdown).toContain("**Report ID**: test-report-123");
      expect(markdown).toContain("**Projects**: project-1, project-2");
      expect(markdown).toContain("## Summary");
      expect(markdown).toContain(mockReport.summary);
      expect(markdown).toContain("## Project Status");
      expect(markdown).toContain("## Findings");
      expect(markdown).toContain("## Generated Tasks");
    });

    it("should group findings by severity", () => {
      const markdown = service.exportToMarkdown(mockReport);

      expect(markdown).toContain("### Critical (1)");
      expect(markdown).toContain("### Error (1)");
      expect(markdown).toContain("### Warning (1)");
      expect(markdown).toContain("### Info (1)");
    });

    it("should include all finding details", () => {
      const markdown = service.exportToMarkdown(mockReport);

      expect(markdown).toContain("Critical SQL Injection Vulnerability");
      expect(markdown).toContain("**Category**: Security");
      expect(markdown).toContain("**Project**: project-1");
      expect(markdown).toContain("Found SQL injection vulnerability");
    });

    it("should include project reports with health scores", () => {
      const markdown = service.exportToMarkdown(mockReport);

      expect(markdown).toContain("### Main Application");
      expect(markdown).toContain("**Health Score**: 65/100");
      expect(markdown).toContain("**CI Status**: failing");
      expect(markdown).toContain("**Open Issues**: 12");
      expect(markdown).toContain("**Open PRs**: 3");
      expect(markdown).toContain("⚠️ Build failures");
      expect(markdown).toContain("⚠️ Security vulnerabilities");
    });

    it("should include generated task IDs", () => {
      const markdown = service.exportToMarkdown(mockReport);

      expect(markdown).toContain("3 task(s) were generated");
      expect(markdown).toContain("- task-1");
      expect(markdown).toContain("- task-2");
      expect(markdown).toContain("- task-3");
    });

    it("should handle reports without project reports", () => {
      const reportWithoutProjects = { ...mockReport, projectReports: undefined };
      const markdown = service.exportToMarkdown(reportWithoutProjects);

      expect(markdown).not.toContain("## Project Status");
      expect(markdown).toContain("## Summary");
      expect(markdown).toContain("## Findings");
    });

    it("should handle reports with no findings", () => {
      const reportWithoutFindings = { ...mockReport, findings: [] };
      const markdown = service.exportToMarkdown(reportWithoutFindings);

      expect(markdown).not.toContain("## Findings");
      expect(markdown).toContain("## Summary");
    });

    it("should handle reports with no generated tasks", () => {
      const reportWithoutTasks = { ...mockReport, generatedTasks: [] };
      const markdown = service.exportToMarkdown(reportWithoutTasks);

      expect(markdown).not.toContain("## Generated Tasks");
      expect(markdown).toContain("## Summary");
    });

    it("should format different report types correctly", () => {
      const deepAnalysisReport = { ...mockReport, type: "deep_analysis" as const };
      const markdown = service.exportToMarkdown(deepAnalysisReport);

      expect(markdown).toContain("# Analysis Report: Deep Analysis");
    });

    it("should handle empty project IDs", () => {
      const reportWithNoProjects = { ...mockReport, projectIds: [] };
      const markdown = service.exportToMarkdown(reportWithNoProjects);

      expect(markdown).toContain("**Projects**: None");
    });

    it("should handle reports without completion time", () => {
      const incompleteReport = { ...mockReport, completedAt: undefined };
      const markdown = service.exportToMarkdown(incompleteReport);

      expect(markdown).not.toContain("**Completed**:");
      expect(markdown).toContain("**Started**:");
    });
  });

  describe("exportToPDF", () => {
    it("should generate a PDF buffer", async () => {
      const pdfBuffer = await service.exportToPDF(mockReport);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      // Check PDF signature
      expect(pdfBuffer.toString("utf-8", 0, 4)).toBe("%PDF");
    });

    it("should handle reports with all sections", async () => {
      const pdfBuffer = await service.exportToPDF(mockReport);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000); // Should be substantial
    });

    it("should handle minimal reports", async () => {
      const minimalReport: AnalysisReport = {
        id: "minimal-123",
        type: "manual",
        projectIds: [],
        startedAt: Date.now(),
        summary: "Quick manual check",
        findings: [],
        generatedTasks: [],
      };

      const pdfBuffer = await service.exportToPDF(minimalReport);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.toString("utf-8", 0, 4)).toBe("%PDF");
    });

    it("should handle reports with special characters", async () => {
      const reportWithSpecialChars: AnalysisReport = {
        ...mockReport,
        summary: 'Test with <special> & "quoted" characters',
        findings: [
          {
            severity: "info",
            category: "Test",
            title: "Test <html> & special chars",
            description: 'Description with "quotes" and <tags>',
            projectId: "test",
          },
        ],
      };

      const pdfBuffer = await service.exportToPDF(reportWithSpecialChars);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.toString("utf-8", 0, 4)).toBe("%PDF");
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle findings with only one severity level", () => {
      const singleSeverityReport: AnalysisReport = {
        ...mockReport,
        findings: [
          {
            severity: "critical",
            category: "Test",
            title: "Critical Issue 1",
            description: "First critical issue",
            projectId: "project-1",
          },
          {
            severity: "critical",
            category: "Test",
            title: "Critical Issue 2",
            description: "Second critical issue",
            projectId: "project-1",
          },
        ],
      };

      const markdown = service.exportToMarkdown(singleSeverityReport);
      expect(markdown).toContain("### Critical (2)");
      expect(markdown).not.toContain("### Error");
      expect(markdown).not.toContain("### Warning");
      expect(markdown).not.toContain("### Info");
    });

    it("should handle project reports without risks", () => {
      const reportWithoutRisks: AnalysisReport = {
        ...mockReport,
        projectReports: [
          {
            projectId: "safe-project",
            projectName: "Safe Project",
            healthScore: 95,
            openIssues: 0,
            openPRs: 0,
            ciStatus: "passing",
            risks: [],
          },
        ],
      };

      const markdown = service.exportToMarkdown(reportWithoutRisks);
      expect(markdown).toContain("### Safe Project");
      expect(markdown).toContain("**Health Score**: 95/100");
      expect(markdown).not.toContain("**Risks**:");
    });

    it("should handle long descriptions with line breaks", () => {
      const reportWithLongDesc: AnalysisReport = {
        ...mockReport,
        summary: "Line 1\nLine 2\nLine 3\n\nLine 5 after blank line",
      };

      const markdown = service.exportToMarkdown(reportWithLongDesc);
      expect(markdown).toContain("Line 1");
      expect(markdown).toContain("Line 2");
      expect(markdown).toContain("Line 5 after blank line");
    });
  });
});
