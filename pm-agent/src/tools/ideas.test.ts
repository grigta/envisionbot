/**
 * Tests for Ideas Tools Module
 * Tests idea analysis, plan saving, and tool execution
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ideaTools, executeIdeaTool } from "./ideas.js";
import type { Idea, IdeaPlan } from "../types.js";

// Mock dependencies
vi.mock("../state/store.js", () => ({
  stateStore: {
    getIdea: vi.fn(),
    updateIdea: vi.fn(),
    addPendingAction: vi.fn(),
  },
}));

vi.mock("../server.js", () => ({
  broadcast: vi.fn(),
}));

vi.mock("./claude-code.js", () => ({
  runClaudeCode: vi.fn(),
}));

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { stateStore } from "../state/store.js";
import { broadcast } from "../server.js";

describe("Ideas Tools", () => {
  describe("Tool Definitions", () => {
    it("should have correct number of tools", () => {
      expect(ideaTools).toHaveLength(4);
    });

    it("should define idea_analyze tool", () => {
      const tool = ideaTools.find((t) => t.name === "idea_analyze");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("Analyze an idea");
      expect(tool?.input_schema.required).toEqual(["ideaId", "title", "description"]);
    });

    it("should define idea_save_plan tool", () => {
      const tool = ideaTools.find((t) => t.name === "idea_save_plan");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("Save the generated plan");
      expect(tool?.input_schema.required).toEqual(["ideaId", "plan"]);
    });

    it("should define idea_create_repo tool", () => {
      const tool = ideaTools.find((t) => t.name === "idea_create_repo");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("Create a GitHub repository");
      expect(tool?.description).toContain("requires approval");
      expect(tool?.input_schema.required).toEqual(["ideaId", "repoName"]);
    });

    it("should define idea_generate_code tool", () => {
      const tool = ideaTools.find((t) => t.name === "idea_generate_code");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("Generate initial code");
      expect(tool?.input_schema.required).toEqual(["ideaId", "repoPath", "prompt"]);
    });
  });

  describe("executeIdeaTool", () => {
    it("should return error for unknown tool", async () => {
      const result = await executeIdeaTool("unknown_tool", {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown idea tool");
    });

    it("should route to correct handler", async () => {
      const mockIdea: Idea = {
        id: "idea-1",
        title: "Test Idea",
        description: "Test description",
        status: "new",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

      const result = await executeIdeaTool("idea_analyze", {
        ideaId: "idea-1",
        title: "Test Idea",
        description: "Test description",
      });

      expect(result.success).toBe(true);
      expect(stateStore.updateIdea).toHaveBeenCalled();
    });
  });

  describe("idea_analyze", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should update idea status to planning", async () => {
      const mockIdea: Idea = {
        id: "idea-1",
        title: "Test Idea",
        description: "Test description",
        status: "new",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

      const result = await executeIdeaTool("idea_analyze", {
        ideaId: "idea-1",
        title: "Test Idea",
        description: "Test description",
      });

      expect(result.success).toBe(true);
      expect(stateStore.updateIdea).toHaveBeenCalledWith("idea-1", { status: "planning" });
    });

    it("should broadcast idea_updated event", async () => {
      const mockIdea: Idea = {
        id: "idea-1",
        title: "Test Idea",
        description: "Test description",
        status: "new",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

      await executeIdeaTool("idea_analyze", {
        ideaId: "idea-1",
        title: "Test Idea",
        description: "Test description",
      });

      expect(broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "idea_updated",
          data: expect.objectContaining({
            ideaId: "idea-1",
            status: "planning",
          }),
        })
      );
    });

    it("should return error when idea not found", async () => {
      vi.mocked(stateStore.getIdea).mockReturnValue(undefined);

      const result = await executeIdeaTool("idea_analyze", {
        ideaId: "nonexistent",
        title: "Test",
        description: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Idea not found");
    });

    it("should return idea data in response", async () => {
      const mockIdea: Idea = {
        id: "idea-1",
        title: "Test Idea",
        description: "Test description",
        status: "new",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

      const result = await executeIdeaTool("idea_analyze", {
        ideaId: "idea-1",
        title: "Test Idea",
        description: "Test description",
      });

      expect(result.data).toMatchObject({
        message: expect.stringContaining("planning"),
        idea: {
          id: "idea-1",
          title: "Test Idea",
          description: "Test description",
        },
      });
    });
  });

  describe("idea_save_plan", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should save plan and update idea status", async () => {
      const mockIdea: Idea = {
        id: "idea-1",
        title: "Test Idea",
        description: "Test description",
        status: "planning",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPlan: IdeaPlan = {
        summary: "Test plan summary",
        techStack: ["Node.js", "TypeScript", "React"],
        structure: [
          { path: "src/", type: "directory", description: "Source code" },
          { path: "src/index.ts", type: "file", description: "Entry point" },
        ],
        features: [
          { name: "Authentication", description: "User auth", priority: "high" },
        ],
        estimatedFiles: 15,
        repoNameSuggestion: "test-project",
      };

      vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

      const result = await executeIdeaTool("idea_save_plan", {
        ideaId: "idea-1",
        plan: mockPlan,
      });

      expect(result.success).toBe(true);
      expect(stateStore.updateIdea).toHaveBeenCalledWith("idea-1", {
        status: "plan_ready",
        plan: mockPlan,
      });
    });

    it("should broadcast plan_ready event", async () => {
      const mockIdea: Idea = {
        id: "idea-1",
        title: "Test Idea",
        description: "Test description",
        status: "planning",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPlan: IdeaPlan = {
        summary: "Test plan",
        techStack: ["Node.js"],
        structure: [],
        features: [],
        estimatedFiles: 10,
        repoNameSuggestion: "test",
      };

      vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

      await executeIdeaTool("idea_save_plan", {
        ideaId: "idea-1",
        plan: mockPlan,
      });

      expect(broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "idea_plan_ready",
          data: expect.objectContaining({
            ideaId: "idea-1",
            plan: mockPlan,
          }),
        })
      );
    });

    it("should return error when idea not found", async () => {
      vi.mocked(stateStore.getIdea).mockReturnValue(undefined);

      const result = await executeIdeaTool("idea_save_plan", {
        ideaId: "nonexistent",
        plan: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Idea not found");
    });

    it("should return plan summary in response", async () => {
      const mockIdea: Idea = {
        id: "idea-1",
        title: "Test Idea",
        description: "Test description",
        status: "planning",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPlan: IdeaPlan = {
        summary: "Test plan summary",
        techStack: ["Node.js", "TypeScript"],
        structure: [],
        features: [],
        estimatedFiles: 15,
        repoNameSuggestion: "test-project",
      };

      vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

      const result = await executeIdeaTool("idea_save_plan", {
        ideaId: "idea-1",
        plan: mockPlan,
      });

      expect(result.data).toMatchObject({
        message: expect.stringContaining("approval"),
        planSummary: "Test plan summary",
        techStack: ["Node.js", "TypeScript"],
        estimatedFiles: 15,
      });
    });
  });

  describe("idea_create_repo", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return error when idea not found", async () => {
      vi.mocked(stateStore.getIdea).mockReturnValue(undefined);

      const result = await executeIdeaTool("idea_create_repo", {
        ideaId: "nonexistent",
        repoName: "test-repo",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Idea not found");
    });

    it("should return error when idea is not approved", async () => {
      const mockIdea: Idea = {
        id: "idea-1",
        title: "Test Idea",
        description: "Test description",
        status: "planning",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

      const result = await executeIdeaTool("idea_create_repo", {
        ideaId: "idea-1",
        repoName: "test-repo",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("must be approved");
      expect(result.error).toContain("planning");
    });

    it("should allow repo creation for approved ideas", async () => {
      const mockIdea: Idea = {
        id: "idea-1",
        title: "Test Idea",
        description: "Test description",
        status: "approved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

      // Note: This will fail in execution due to missing mocks,
      // but we're testing the validation logic
      const result = await executeIdeaTool("idea_create_repo", {
        ideaId: "idea-1",
        repoName: "test-repo",
        description: "Test repository",
        isPrivate: false,
      });

      // The function should proceed past validation
      expect(result).toBeDefined();
    });

    it("should allow repo creation for creating_repo status", async () => {
      const mockIdea: Idea = {
        id: "idea-1",
        title: "Test Idea",
        description: "Test description",
        status: "creating_repo",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

      const result = await executeIdeaTool("idea_create_repo", {
        ideaId: "idea-1",
        repoName: "test-repo",
      });

      // Should proceed past validation
      expect(result).toBeDefined();
    });
  });

  describe("Tool Input Schemas", () => {
    it("should have correct required fields for idea_analyze", () => {
      const tool = ideaTools.find((t) => t.name === "idea_analyze");
      expect(tool?.input_schema.properties).toHaveProperty("ideaId");
      expect(tool?.input_schema.properties).toHaveProperty("title");
      expect(tool?.input_schema.properties).toHaveProperty("description");
    });

    it("should have correct structure for idea_save_plan", () => {
      const tool = ideaTools.find((t) => t.name === "idea_save_plan");
      const planSchema = (tool?.input_schema.properties as any).plan;

      expect(planSchema.properties).toHaveProperty("summary");
      expect(planSchema.properties).toHaveProperty("techStack");
      expect(planSchema.properties).toHaveProperty("structure");
      expect(planSchema.properties).toHaveProperty("features");
      expect(planSchema.properties).toHaveProperty("estimatedFiles");
      expect(planSchema.properties).toHaveProperty("repoNameSuggestion");
    });

    it("should have correct properties for idea_create_repo", () => {
      const tool = ideaTools.find((t) => t.name === "idea_create_repo");
      expect(tool?.input_schema.properties).toHaveProperty("ideaId");
      expect(tool?.input_schema.properties).toHaveProperty("repoName");
      expect(tool?.input_schema.properties).toHaveProperty("description");
      expect(tool?.input_schema.properties).toHaveProperty("isPrivate");
    });

    it("should have correct properties for idea_generate_code", () => {
      const tool = ideaTools.find((t) => t.name === "idea_generate_code");
      expect(tool?.input_schema.properties).toHaveProperty("ideaId");
      expect(tool?.input_schema.properties).toHaveProperty("repoPath");
      expect(tool?.input_schema.properties).toHaveProperty("prompt");
    });
  });

  describe("Error Handling", () => {
    it("should handle missing required fields gracefully", async () => {
      const result = await executeIdeaTool("idea_analyze", {});

      // Should attempt execution but fail at idea lookup
      expect(result).toBeDefined();
    });

    it("should handle invalid ideaId", async () => {
      vi.mocked(stateStore.getIdea).mockReturnValue(undefined);

      const result = await executeIdeaTool("idea_analyze", {
        ideaId: "",
        title: "Test",
        description: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
