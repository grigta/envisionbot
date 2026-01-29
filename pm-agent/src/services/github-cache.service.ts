/**
 * GitHub Cache Service
 * Caches GitHub CLI command results to reduce API load
 */

import type { CacheClient } from "../db/redis.js";
import crypto from "node:crypto";

export interface GitHubCacheConfig {
  /** Default TTL in seconds for cached responses */
  defaultTTL: number;
  /** TTL for repository status queries */
  repoStatusTTL: number;
  /** TTL for issue lists */
  issueListTTL: number;
  /** TTL for PR lists */
  prListTTL: number;
  /** TTL for workflow run status */
  workflowRunTTL: number;
  /** TTL for individual issue info */
  issueInfoTTL: number;
  /** Enable/disable caching globally */
  enabled: boolean;
}

const DEFAULT_CONFIG: GitHubCacheConfig = {
  defaultTTL: 300, // 5 minutes
  repoStatusTTL: 300, // 5 minutes
  issueListTTL: 180, // 3 minutes
  prListTTL: 180, // 3 minutes
  workflowRunTTL: 120, // 2 minutes
  issueInfoTTL: 300, // 5 minutes
  enabled: true,
};

export class GitHubCacheService {
  private config: GitHubCacheConfig;
  private readonly CACHE_PREFIX = "gh:";

  constructor(
    private cache: CacheClient,
    config: Partial<GitHubCacheConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get cached result or execute command
   * @param args - GitHub CLI arguments
   * @param executor - Function that executes the command
   * @param ttl - Optional TTL override
   * @returns Command result
   */
  async getCached(
    args: string[],
    executor: () => Promise<string>,
    ttl?: number
  ): Promise<string> {
    // Skip caching if disabled
    if (!this.config.enabled) {
      return executor();
    }

    // Skip caching for write operations
    if (this.isWriteOperation(args)) {
      return executor();
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(args);

    // Try to get from cache
    const cached = await this.cache.get(cacheKey);
    if (cached !== null) {
      console.log(`GitHub cache hit: ${args.join(" ")}`);
      return cached;
    }

    // Execute command
    console.log(`GitHub cache miss: ${args.join(" ")}`);
    const result = await executor();

    // Store in cache
    const cacheTTL = ttl ?? this.getTTLForCommand(args);
    await this.cache.setex(cacheKey, cacheTTL, result);

    return result;
  }

  /**
   * Invalidate cached results for a repository
   * @param repo - Repository in owner/repo format
   */
  async invalidateRepo(repo: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}*:${repo}:*`;
    const keys = await this.cache.keys(pattern);
    if (keys.length > 0) {
      await this.cache.del(...keys);
      console.log(`Invalidated ${keys.length} cache entries for ${repo}`);
    }
  }

  /**
   * Invalidate all GitHub cache entries
   */
  async invalidateAll(): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}*`;
    const keys = await this.cache.keys(pattern);
    if (keys.length > 0) {
      await this.cache.del(...keys);
      console.log(`Invalidated ${keys.length} GitHub cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    keysByCommand: Record<string, number>;
  }> {
    const pattern = `${this.CACHE_PREFIX}*`;
    const keys = await this.cache.keys(pattern);

    const keysByCommand: Record<string, number> = {};
    for (const key of keys) {
      const parts = key.split(":");
      if (parts.length >= 2) {
        const command = parts[1];
        keysByCommand[command] = (keysByCommand[command] || 0) + 1;
      }
    }

    return {
      totalKeys: keys.length,
      keysByCommand,
    };
  }

  /**
   * Generate cache key from GitHub CLI arguments
   */
  private generateCacheKey(args: string[]): string {
    // Extract command type and repo
    const commandType = args[0]; // 'repo', 'issue', 'pr', 'run'
    const repo = this.extractRepo(args);

    // Create stable hash of arguments
    const argsHash = crypto
      .createHash("md5")
      .update(JSON.stringify(args))
      .digest("hex")
      .substring(0, 8);

    return `${this.CACHE_PREFIX}${commandType}:${repo}:${argsHash}`;
  }

  /**
   * Extract repository from GitHub CLI arguments
   */
  private extractRepo(args: string[]): string {
    // Look for -R or --repo flag
    const repoIndex = args.findIndex((arg) => arg === "-R" || arg === "--repo");
    if (repoIndex !== -1 && repoIndex + 1 < args.length) {
      return args[repoIndex + 1];
    }

    // For 'repo view' command, repo might be the third argument
    if (args[0] === "repo" && args[1] === "view" && args.length > 2) {
      return args[2];
    }

    return "unknown";
  }

  /**
   * Check if command is a write operation
   */
  private isWriteOperation(args: string[]): boolean {
    const writeCommands = ["create", "edit", "delete", "close", "reopen", "comment"];
    return args.some((arg) => writeCommands.includes(arg));
  }

  /**
   * Get TTL for specific command type
   */
  private getTTLForCommand(args: string[]): number {
    const commandType = args[0];
    const subCommand = args[1];

    // repo view/status
    if (commandType === "repo") {
      return this.config.repoStatusTTL;
    }

    // issue list/view
    if (commandType === "issue") {
      if (subCommand === "list") {
        return this.config.issueListTTL;
      }
      if (subCommand === "view") {
        return this.config.issueInfoTTL;
      }
    }

    // pr list
    if (commandType === "pr" && subCommand === "list") {
      return this.config.prListTTL;
    }

    // run list
    if (commandType === "run" && subCommand === "list") {
      return this.config.workflowRunTTL;
    }

    return this.config.defaultTTL;
  }
}
