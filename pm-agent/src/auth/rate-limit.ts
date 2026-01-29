/**
 * Rate limiting middleware for API endpoints
 * Uses sliding window algorithm with Redis (or in-memory fallback)
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { CacheClient } from "../db/redis.js";

export interface RateLimitConfig {
  /**
   * Maximum requests allowed in the time window
   */
  max: number;

  /**
   * Time window in seconds
   */
  windowSec: number;

  /**
   * Message to send when rate limit exceeded
   */
  message?: string;

  /**
   * Skip rate limiting for certain paths
   */
  skipPaths?: string[];

  /**
   * Separate limits for authenticated users
   */
  authenticatedMax?: number;
}

export interface RateLimitDeps {
  cache: CacheClient;
}

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  max: 100, // 100 requests
  windowSec: 60, // per minute
  message: "Too many requests, please try again later",
  skipPaths: ["/api/health"],
  authenticatedMax: 300, // Higher limit for authenticated users
};

/**
 * Get client identifier from request
 * Uses user ID for authenticated requests, IP address for anonymous
 */
function getClientId(request: FastifyRequest): string {
  // Use user ID if authenticated
  if (request.user?.id) {
    return `user:${request.user.id}`;
  }

  // Fall back to IP address
  const forwarded = request.headers["x-forwarded-for"];
  const ip = forwarded
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0])
    : request.ip;

  return `ip:${ip}`;
}

/**
 * Check if path should skip rate limiting
 */
function shouldSkipPath(path: string, skipPaths: string[]): boolean {
  return skipPaths.some((skipPath) => path === skipPath || path.startsWith(skipPath));
}

/**
 * Create rate limiting hook for Fastify
 */
export function createRateLimitHook(
  deps: RateLimitDeps,
  userConfig: Partial<RateLimitConfig> = {}
) {
  const config: RateLimitConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Skip rate limiting for certain paths
    if (config.skipPaths && shouldSkipPath(request.url, config.skipPaths)) {
      return;
    }

    const clientId = getClientId(request);
    const isAuthenticated = !!request.user?.id;
    const maxRequests = isAuthenticated && config.authenticatedMax
      ? config.authenticatedMax
      : config.max;

    // Create rate limit key
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / config.windowSec);
    const key = `ratelimit:${clientId}:${window}`;

    try {
      // Increment counter
      const count = await deps.cache.incr(key);

      // Set expiration on first request in window
      if (count === 1) {
        await deps.cache.expire(key, config.windowSec * 2); // Keep for 2 windows to handle edge cases
      }

      // Check if limit exceeded
      if (count > maxRequests) {
        const resetTime = (window + 1) * config.windowSec;
        const retryAfter = resetTime - now;

        reply
          .status(429)
          .header("X-RateLimit-Limit", maxRequests.toString())
          .header("X-RateLimit-Remaining", "0")
          .header("X-RateLimit-Reset", resetTime.toString())
          .header("Retry-After", retryAfter.toString())
          .send({
            error: "Too Many Requests",
            message: config.message,
            retryAfter,
          });

        return;
      }

      // Add rate limit headers to response
      const remaining = Math.max(0, maxRequests - count);
      const resetTime = (window + 1) * config.windowSec;

      reply.header("X-RateLimit-Limit", maxRequests.toString());
      reply.header("X-RateLimit-Remaining", remaining.toString());
      reply.header("X-RateLimit-Reset", resetTime.toString());
    } catch (error) {
      // On error, log but don't block request
      console.error("Rate limit error:", error);
    }
  };
}

/**
 * Get rate limit status for a client
 * Useful for monitoring and debugging
 */
export async function getRateLimitStatus(
  deps: RateLimitDeps,
  clientId: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<{
  current: number;
  limit: number;
  remaining: number;
  resetAt: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / config.windowSec);
  const key = `ratelimit:${clientId}:${window}`;

  const currentStr = await deps.cache.get(key);
  const current = currentStr ? parseInt(currentStr, 10) : 0;
  const limit = config.max;
  const remaining = Math.max(0, limit - current);
  const resetAt = (window + 1) * config.windowSec;

  return { current, limit, remaining, resetAt };
}
