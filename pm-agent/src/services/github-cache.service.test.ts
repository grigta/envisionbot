import { describe, it, expect, beforeEach, vi } from "vitest";
import { GitHubCacheService } from "./github-cache.service.js";
import type { CacheClient } from "../db/redis.js";

describe("GitHubCacheService", () => {
  let mockCache: CacheClient;
  let service: GitHubCacheService;

  beforeEach(() => {
    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      setex: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(0),
      keys: vi.fn().mockResolvedValue([]),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(true),
      quit: vi.fn().mockResolvedValue(undefined),
    };

    service = new GitHubCacheService(mockCache);
  });

  describe("getCached", () => {
    it("should execute command and cache result on cache miss", async () => {
      const args = ["repo", "view", "owner/repo", "--json", "name"];
      const result = '{"name":"repo"}';
      const executor = vi.fn().mockResolvedValue(result);

      const output = await service.getCached(args, executor);

      expect(output).toBe(result);
      expect(executor).toHaveBeenCalledTimes(1);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockCache.setex).toHaveBeenCalledWith(
        expect.stringContaining("gh:repo:owner/repo:"),
        300, // repoStatusTTL
        result
      );
    });

    it("should return cached result on cache hit", async () => {
      const args = ["repo", "view", "owner/repo", "--json", "name"];
      const cachedResult = '{"name":"repo"}';
      const executor = vi.fn();

      vi.mocked(mockCache.get).mockResolvedValue(cachedResult);

      const output = await service.getCached(args, executor);

      expect(output).toBe(cachedResult);
      expect(executor).not.toHaveBeenCalled();
      expect(mockCache.setex).not.toHaveBeenCalled();
    });

    it("should skip caching for write operations", async () => {
      const args = ["issue", "create", "-R", "owner/repo", "--title", "Test"];
      const result = "https://github.com/owner/repo/issues/1";
      const executor = vi.fn().mockResolvedValue(result);

      const output = await service.getCached(args, executor);

      expect(output).toBe(result);
      expect(executor).toHaveBeenCalledTimes(1);
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.setex).not.toHaveBeenCalled();
    });

    it("should skip caching when disabled", async () => {
      const disabledService = new GitHubCacheService(mockCache, { enabled: false });
      const args = ["repo", "view", "owner/repo"];
      const result = '{"name":"repo"}';
      const executor = vi.fn().mockResolvedValue(result);

      const output = await disabledService.getCached(args, executor);

      expect(output).toBe(result);
      expect(executor).toHaveBeenCalledTimes(1);
      expect(mockCache.get).not.toHaveBeenCalled();
    });

    it("should use custom TTL when provided", async () => {
      const args = ["issue", "list", "-R", "owner/repo"];
      const result = "[]";
      const executor = vi.fn().mockResolvedValue(result);
      const customTTL = 60;

      await service.getCached(args, executor, customTTL);

      expect(mockCache.setex).toHaveBeenCalledWith(
        expect.any(String),
        customTTL,
        result
      );
    });

    it("should use appropriate TTL for different command types", async () => {
      const testCases = [
        { args: ["repo", "view", "owner/repo"], expectedTTL: 300 },
        { args: ["issue", "list", "-R", "owner/repo"], expectedTTL: 180 },
        { args: ["pr", "list", "-R", "owner/repo"], expectedTTL: 180 },
        { args: ["run", "list", "-R", "owner/repo"], expectedTTL: 120 },
        { args: ["issue", "view", "123", "-R", "owner/repo"], expectedTTL: 300 },
      ];

      for (const { args, expectedTTL } of testCases) {
        const executor = vi.fn().mockResolvedValue("result");
        await service.getCached(args, executor);

        expect(mockCache.setex).toHaveBeenCalledWith(
          expect.any(String),
          expectedTTL,
          "result"
        );

        vi.clearAllMocks();
      }
    });
  });

  describe("invalidateRepo", () => {
    it("should delete all cache entries for a repository", async () => {
      const repo = "owner/repo";
      const keys = [
        "gh:repo:owner/repo:abc123",
        "gh:issue:owner/repo:def456",
        "gh:pr:owner/repo:ghi789",
      ];

      vi.mocked(mockCache.keys).mockResolvedValue(keys);

      await service.invalidateRepo(repo);

      expect(mockCache.keys).toHaveBeenCalledWith("gh:*:owner/repo:*");
      expect(mockCache.del).toHaveBeenCalledWith(...keys);
    });

    it("should not call del when no keys found", async () => {
      vi.mocked(mockCache.keys).mockResolvedValue([]);

      await service.invalidateRepo("owner/repo");

      expect(mockCache.del).not.toHaveBeenCalled();
    });
  });

  describe("invalidateAll", () => {
    it("should delete all GitHub cache entries", async () => {
      const keys = [
        "gh:repo:owner/repo:abc",
        "gh:issue:owner/repo:def",
        "gh:pr:another/repo:ghi",
      ];

      vi.mocked(mockCache.keys).mockResolvedValue(keys);

      await service.invalidateAll();

      expect(mockCache.keys).toHaveBeenCalledWith("gh:*");
      expect(mockCache.del).toHaveBeenCalledWith(...keys);
    });
  });

  describe("getStats", () => {
    it("should return cache statistics", async () => {
      const keys = [
        "gh:repo:owner/repo:abc",
        "gh:repo:another/repo:def",
        "gh:issue:owner/repo:ghi",
        "gh:pr:owner/repo:jkl",
        "gh:pr:another/repo:mno",
      ];

      vi.mocked(mockCache.keys).mockResolvedValue(keys);

      const stats = await service.getStats();

      expect(stats.totalKeys).toBe(5);
      expect(stats.keysByCommand).toEqual({
        repo: 2,
        issue: 1,
        pr: 2,
      });
    });
  });

  describe("cache key generation", () => {
    it("should generate consistent cache keys for the same arguments", async () => {
      const args = ["repo", "view", "owner/repo", "--json", "name"];
      const executor = vi.fn().mockResolvedValue("result");

      await service.getCached(args, executor);
      const firstKey = vi.mocked(mockCache.setex).mock.calls[0][0];

      vi.clearAllMocks();
      vi.mocked(mockCache.get).mockResolvedValue(null);

      await service.getCached(args, executor);
      const secondKey = vi.mocked(mockCache.setex).mock.calls[0][0];

      expect(firstKey).toBe(secondKey);
    });

    it("should generate different cache keys for different arguments", async () => {
      const executor = vi.fn().mockResolvedValue("result");

      await service.getCached(["repo", "view", "owner/repo1"], executor);
      const key1 = vi.mocked(mockCache.setex).mock.calls[0][0];

      vi.clearAllMocks();

      await service.getCached(["repo", "view", "owner/repo2"], executor);
      const key2 = vi.mocked(mockCache.setex).mock.calls[0][0];

      expect(key1).not.toBe(key2);
    });
  });

  describe("write operation detection", () => {
    it("should identify write operations correctly", async () => {
      const writeCommands = [
        ["issue", "create", "-R", "owner/repo"],
        ["issue", "edit", "123", "-R", "owner/repo"],
        ["issue", "delete", "123", "-R", "owner/repo"],
        ["issue", "close", "123", "-R", "owner/repo"],
        ["issue", "reopen", "123", "-R", "owner/repo"],
        ["issue", "comment", "123", "-R", "owner/repo"],
      ];

      for (const args of writeCommands) {
        const executor = vi.fn().mockResolvedValue("result");
        await service.getCached(args, executor);

        expect(mockCache.get).not.toHaveBeenCalled();
        expect(mockCache.setex).not.toHaveBeenCalled();

        vi.clearAllMocks();
      }
    });

    it("should not cache read operations as write operations", async () => {
      const readCommands = [
        ["issue", "list", "-R", "owner/repo"],
        ["issue", "view", "123", "-R", "owner/repo"],
        ["pr", "list", "-R", "owner/repo"],
        ["repo", "view", "owner/repo"],
      ];

      for (const args of readCommands) {
        const executor = vi.fn().mockResolvedValue("result");
        await service.getCached(args, executor);

        expect(mockCache.get).toHaveBeenCalled();

        vi.clearAllMocks();
      }
    });
  });
});
