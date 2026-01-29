/**
 * Tests for rate limiting middleware
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createRateLimitHook, getRateLimitStatus } from "../rate-limit.js";
import type { CacheClient } from "../../db/redis.js";

// Mock cache implementation for testing
class MockCache implements CacheClient {
  private data = new Map<string, { value: string; expiresAt?: number }>();
  private counters = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt * 1000) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Math.floor(Date.now() / 1000) + ttl : undefined;
    this.data.set(key, { value, expiresAt });
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.set(key, value, ttl);
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.data.delete(key)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return Array.from(this.data.keys()).filter((k) => regex.test(k));
  }

  async incr(key: string): Promise<number> {
    const current = this.counters.get(key) ?? 0;
    const next = current + 1;
    this.counters.set(key, next);
    return next;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const entry = this.data.get(key);
    if (!entry) return false;
    entry.expiresAt = Math.floor(Date.now() / 1000) + seconds;
    return true;
  }

  async quit(): Promise<void> {
    this.data.clear();
    this.counters.clear();
  }

  reset(): void {
    this.data.clear();
    this.counters.clear();
  }
}

describe("Rate Limiting", () => {
  let mockCache: MockCache;

  beforeEach(() => {
    mockCache = new MockCache();
  });

  it("should allow requests within limit", async () => {
    const hook = createRateLimitHook({ cache: mockCache }, { max: 5, windowSec: 60 });

    const mockRequest: any = {
      url: "/api/test",
      ip: "127.0.0.1",
      headers: {},
    };

    const mockReply: any = {
      header: () => mockReply,
      status: () => mockReply,
      send: () => mockReply,
    };

    // Should allow first 5 requests
    for (let i = 0; i < 5; i++) {
      await hook(mockRequest, mockReply);
    }

    // Check the rate limit status
    const status = await getRateLimitStatus(
      { cache: mockCache },
      "ip:127.0.0.1",
      { max: 5, windowSec: 60 }
    );

    expect(status.current).toBe(5);
    expect(status.remaining).toBe(0);
  });

  it("should block requests exceeding limit", async () => {
    const hook = createRateLimitHook({ cache: mockCache }, { max: 3, windowSec: 60 });

    const mockRequest: any = {
      url: "/api/test",
      ip: "127.0.0.1",
      headers: {},
    };

    let blocked = false;
    const mockReply: any = {
      header: () => mockReply,
      status: (code: number) => {
        if (code === 429) blocked = true;
        return mockReply;
      },
      send: () => mockReply,
    };

    // Make 4 requests (one over the limit)
    for (let i = 0; i < 4; i++) {
      await hook(mockRequest, mockReply);
    }

    expect(blocked).toBe(true);
  });

  it("should skip rate limiting for configured paths", async () => {
    const hook = createRateLimitHook(
      { cache: mockCache },
      { max: 1, windowSec: 60, skipPaths: ["/api/health"] }
    );

    const mockRequest: any = {
      url: "/api/health",
      ip: "127.0.0.1",
      headers: {},
    };

    let blocked = false;
    const mockReply: any = {
      header: () => mockReply,
      status: (code: number) => {
        if (code === 429) blocked = true;
        return mockReply;
      },
      send: () => mockReply,
    };

    // Make 5 requests to health endpoint (should all pass)
    for (let i = 0; i < 5; i++) {
      await hook(mockRequest, mockReply);
    }

    expect(blocked).toBe(false);
  });

  it("should use higher limits for authenticated users", async () => {
    const hook = createRateLimitHook(
      { cache: mockCache },
      { max: 2, windowSec: 60, authenticatedMax: 10 }
    );

    const mockRequest: any = {
      url: "/api/test",
      ip: "127.0.0.1",
      headers: {},
      user: { id: "user123", name: "Test User", role: "user" },
    };

    const mockReply: any = {
      header: () => mockReply,
      status: () => mockReply,
      send: () => mockReply,
    };

    // Should allow 10 requests for authenticated user
    for (let i = 0; i < 10; i++) {
      await hook(mockRequest, mockReply);
    }

    const status = await getRateLimitStatus(
      { cache: mockCache },
      "user:user123",
      { max: 10, windowSec: 60 }
    );

    expect(status.current).toBe(10);
    expect(status.remaining).toBe(0);
  });

  it("should track different IPs separately", async () => {
    const hook = createRateLimitHook({ cache: mockCache }, { max: 2, windowSec: 60 });

    const mockReply: any = {
      header: () => mockReply,
      status: () => mockReply,
      send: () => mockReply,
    };

    // IP 1 makes 2 requests
    const request1: any = { url: "/api/test", ip: "1.1.1.1", headers: {} };
    await hook(request1, mockReply);
    await hook(request1, mockReply);

    // IP 2 should still have their limit
    const request2: any = { url: "/api/test", ip: "2.2.2.2", headers: {} };
    await hook(request2, mockReply);

    const status1 = await getRateLimitStatus({ cache: mockCache }, "ip:1.1.1.1", {
      max: 2,
      windowSec: 60,
    });
    const status2 = await getRateLimitStatus({ cache: mockCache }, "ip:2.2.2.2", {
      max: 2,
      windowSec: 60,
    });

    expect(status1.current).toBe(2);
    expect(status2.current).toBe(1);
  });
});
