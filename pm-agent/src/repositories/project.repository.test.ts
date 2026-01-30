/**
 * Tests for ProjectRepository
 * Tests CRUD operations, caching, and data transformations
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProjectRepository } from "./project.repository.js";
import type { Project } from "../types.js";
import type { RepositoryDeps, DatabaseSync, CacheClient, PubSubClient } from "../db/index.js";

describe("ProjectRepository", () => {
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubSub: PubSubClient;
  let repository: ProjectRepository;

  const mockProject: Project = {
    id: "project-1",
    name: "Test Project",
    repo: "owner/repo",
    phase: "mvp",
    monitoringLevel: "standard",
    goals: ["Goal 1", "Goal 2"],
    focusAreas: [
      { area: "backend", priority: "high", notes: "API development" },
      { area: "frontend", priority: "medium", notes: "UI polish" },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockProjectRow = {
    id: mockProject.id,
    name: mockProject.name,
    repo: mockProject.repo,
    phase: mockProject.phase,
    monitoring_level: mockProject.monitoringLevel,
    goals: JSON.stringify(mockProject.goals),
    focus_areas: JSON.stringify(mockProject.focusAreas),
    created_at: mockProject.createdAt,
    updated_at: mockProject.updatedAt,
  };

  beforeEach(() => {
    // Create mock statement
    const mockStmt = {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
    };

    // Create mock database
    mockDb = {
      prepare: vi.fn(() => mockStmt),
      exec: vi.fn(),
      close: vi.fn(),
    } as unknown as DatabaseSync;

    // Create mock cache
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(() => []),
    } as unknown as CacheClient;

    // Create mock pub/sub
    mockPubSub = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      on: vi.fn(),
    } as unknown as PubSubClient;

    const deps: RepositoryDeps = {
      db: mockDb,
      cache: mockCache,
      pubsub: mockPubSub,
    };

    repository = new ProjectRepository(deps);
  });

  describe("getAll", () => {
    it("should return cached projects when available", async () => {
      const cachedProjects = [mockProject];
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(cachedProjects));

      const result = await repository.getAll();

      expect(result).toEqual(cachedProjects);
      expect(mockCache.get).toHaveBeenCalledWith("pm:project:list:all");
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("should fetch from database when cache is empty", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([mockProjectRow]);

      const result = await repository.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockProject.id,
        name: mockProject.name,
        repo: mockProject.repo,
      });
      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM projects ORDER BY updated_at DESC");
      expect(mockCache.setex).toHaveBeenCalled();
    });

    it("should return empty array when no projects exist", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([]);

      const result = await repository.getAll();

      expect(result).toEqual([]);
    });

    it("should parse JSON fields correctly", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([mockProjectRow]);

      const result = await repository.getAll();

      expect(result[0].goals).toEqual(mockProject.goals);
      expect(result[0].focusAreas).toEqual(mockProject.focusAreas);
    });
  });

  describe("getById", () => {
    it("should return cached project when available", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockProject));

      const result = await repository.getById("project-1");

      expect(result).toEqual(mockProject);
      expect(mockCache.get).toHaveBeenCalledWith("pm:project:project-1");
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("should fetch from database when cache is empty", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(mockProjectRow);

      const result = await repository.getById("project-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("project-1");
      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM projects WHERE id = ?");
      expect(mockCache.setex).toHaveBeenCalled();
    });

    it("should return undefined when project not found", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(undefined);

      const result = await repository.getById("nonexistent");

      expect(result).toBeUndefined();
    });

    it("should cache the fetched project", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(mockProjectRow);

      await repository.getById("project-1");

      expect(mockCache.setex).toHaveBeenCalledWith(
        "pm:project:project-1",
        expect.any(Number),
        expect.stringContaining('"id":"project-1"')
      );
    });
  });

  describe("getByName", () => {
    it("should fetch project by name case-insensitively", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(mockProjectRow);

      const result = await repository.getByName("Test Project");

      expect(result).toBeDefined();
      expect(result?.name).toBe("Test Project");
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "SELECT * FROM projects WHERE LOWER(name) = LOWER(?)"
      );
    });

    it("should return undefined when not found", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(undefined);

      const result = await repository.getByName("Nonexistent");

      expect(result).toBeUndefined();
    });

    it("should handle case variations", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(mockProjectRow);

      await repository.getByName("TEST PROJECT");

      expect(mockStmt).toHaveBeenCalledWith("TEST PROJECT");
    });
  });

  describe("getByRepo", () => {
    it("should fetch project by repo case-insensitively", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(mockProjectRow);

      const result = await repository.getByRepo("owner/repo");

      expect(result).toBeDefined();
      expect(result?.repo).toBe("owner/repo");
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "SELECT * FROM projects WHERE LOWER(repo) = LOWER(?)"
      );
    });

    it("should return undefined when not found", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(undefined);

      const result = await repository.getByRepo("nonexistent/repo");

      expect(result).toBeUndefined();
    });
  });

  describe("upsert", () => {
    it("should insert new project", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      const result = await repository.upsert(mockProject);

      expect(result).toEqual(mockProject);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO projects"));
      expect(mockStmt).toHaveBeenCalledWith(
        mockProject.id,
        mockProject.name,
        mockProject.repo,
        mockProject.phase,
        mockProject.monitoringLevel,
        JSON.stringify(mockProject.goals),
        JSON.stringify(mockProject.focusAreas),
        mockProject.createdAt,
        mockProject.updatedAt
      );
    });

    it("should update existing project on conflict", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.upsert(mockProject);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("ON CONFLICT(id) DO UPDATE SET")
      );
    });

    it("should invalidate relevant caches", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.upsert(mockProject);

      expect(mockCache.del).toHaveBeenCalledWith(
        "pm:project:project-1",
        "pm:project:list:all",
        "pm:stats"
      );
    });

    it("should publish upsert event", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.upsert(mockProject);

      expect(mockPubSub.publish).toHaveBeenCalledWith(
        "pm:events:projects",
        expect.stringContaining("project_upserted")
      );
    });

    it("should serialize complex fields correctly", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.upsert(mockProject);

      expect(mockStmt).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        JSON.stringify(mockProject.goals),
        JSON.stringify(mockProject.focusAreas),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("delete", () => {
    it("should delete existing project", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      const result = await repository.delete("project-1");

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith("DELETE FROM projects WHERE id = ?");
      expect(mockStmt).toHaveBeenCalledWith("project-1");
    });

    it("should return false when project not found", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 0 });

      const result = await repository.delete("nonexistent");

      expect(result).toBe(false);
    });

    it("should invalidate caches on successful delete", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.delete("project-1");

      expect(mockCache.del).toHaveBeenCalledWith(
        "pm:project:project-1",
        "pm:project:list:all",
        "pm:stats"
      );
    });

    it("should publish delete event", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.delete("project-1");

      expect(mockPubSub.publish).toHaveBeenCalledWith(
        "pm:events:projects",
        expect.stringContaining("project_deleted")
      );
    });

    it("should not invalidate cache when delete fails", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 0 });

      await repository.delete("nonexistent");

      expect(mockCache.del).not.toHaveBeenCalled();
      expect(mockPubSub.publish).not.toHaveBeenCalled();
    });
  });

  describe("Data Transformation", () => {
    it("should correctly transform row to project", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(mockProjectRow);

      const result = await repository.getById("project-1");

      expect(result).toMatchObject({
        id: mockProject.id,
        name: mockProject.name,
        repo: mockProject.repo,
        phase: mockProject.phase,
        monitoringLevel: mockProject.monitoringLevel,
      });
      expect(result?.goals).toEqual(mockProject.goals);
      expect(result?.focusAreas).toEqual(mockProject.focusAreas);
    });

    it("should handle different phases", async () => {
      const phases: Array<Project["phase"]> = ["mvp", "alpha", "beta", "production"];

      for (const phase of phases) {
        const row = { ...mockProjectRow, phase };
        const mockStmt = vi.mocked(mockDb.prepare("")).get;
        mockStmt.mockReturnValue(row);
        vi.mocked(mockCache.get).mockResolvedValue(null);

        const result = await repository.getById("project-1");

        expect(result?.phase).toBe(phase);
      }
    });

    it("should handle different monitoring levels", async () => {
      const levels: Array<Project["monitoringLevel"]> = ["minimal", "standard", "intensive"];

      for (const level of levels) {
        const row = { ...mockProjectRow, monitoring_level: level };
        const mockStmt = vi.mocked(mockDb.prepare("")).get;
        mockStmt.mockReturnValue(row);
        vi.mocked(mockCache.get).mockResolvedValue(null);

        const result = await repository.getById("project-1");

        expect(result?.monitoringLevel).toBe(level);
      }
    });
  });
});
