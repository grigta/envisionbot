/**
 * Redis connection with in-memory fallback
 * When Redis is unavailable, uses Map-based cache and EventEmitter for pub/sub
 */

import { Redis } from "ioredis";
import { EventEmitter } from "node:events";

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
  quit(): Promise<void>;
}

export interface PubSubClient {
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, handler: (message: string) => void): () => void;
  quit(): Promise<void>;
}

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
}

/**
 * In-memory cache implementation (fallback when Redis unavailable)
 */
class MemoryCache implements CacheClient {
  private cache = new Map<string, { value: string; expiresAt?: number }>();
  private counters = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
    this.cache.set(key, { value, expiresAt });
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.set(key, value, ttl);
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.cache.delete(key)) deleted++;
    }
    return deleted;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    const result: string[] = [];
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        const entry = this.cache.get(key);
        if (!entry?.expiresAt || Date.now() <= entry.expiresAt) {
          result.push(key);
        }
      }
    }
    return result;
  }

  async incr(key: string): Promise<number> {
    const current = this.counters.get(key) ?? 0;
    const next = current + 1;
    this.counters.set(key, next);
    return next;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + seconds * 1000;
    return true;
  }

  async quit(): Promise<void> {
    this.cache.clear();
    this.counters.clear();
  }
}

/**
 * In-memory pub/sub implementation
 */
class MemoryPubSub implements PubSubClient {
  private emitter = new EventEmitter();

  async publish(channel: string, message: string): Promise<number> {
    this.emitter.emit(channel, message);
    return this.emitter.listenerCount(channel);
  }

  subscribe(channel: string, handler: (message: string) => void): () => void {
    this.emitter.on(channel, handler);
    return () => {
      this.emitter.off(channel, handler);
    };
  }

  async quit(): Promise<void> {
    this.emitter.removeAllListeners();
  }
}

/**
 * Redis cache wrapper
 */
class RedisCache implements CacheClient {
  constructor(private redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.setex(key, ttl, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.redis.setex(key, ttl, value);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.redis.expire(key, seconds);
    return result === 1;
  }

  async quit(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * Redis pub/sub wrapper
 */
class RedisPubSub implements PubSubClient {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers = new Map<string, Set<(message: string) => void>>();

  constructor(config: RedisConfig) {
    this.publisher = createRedisClient(config);
    this.subscriber = createRedisClient(config);

    this.subscriber.on("message", (channel: string, message: string) => {
      const channelHandlers = this.handlers.get(channel);
      if (channelHandlers) {
        for (const handler of channelHandlers) {
          try {
            handler(message);
          } catch (error) {
            console.error(`Pub/sub handler error on ${channel}:`, error);
          }
        }
      }
    });
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.publisher.publish(channel, message);
  }

  subscribe(channel: string, handler: (message: string) => void): () => void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      this.subscriber.subscribe(channel);
    }

    const handlers = this.handlers.get(channel)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriber.unsubscribe(channel);
        this.handlers.delete(channel);
      }
    };
  }

  async quit(): Promise<void> {
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }
}

/**
 * Create Redis client
 */
function createRedisClient(config: RedisConfig): Redis {
  if (config.url) {
    return new Redis(config.url);
  }
  return new Redis({
    host: config.host || "localhost",
    port: config.port || 6379,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) return null; // Stop retrying
      return Math.min(times * 200, 2000);
    },
  });
}

export interface RedisConnection {
  cache: CacheClient;
  pubsub: PubSubClient;
  isConnected: boolean;
  close: () => Promise<void>;
}

/**
 * Initialize Redis connection with fallback to in-memory
 */
export async function initRedis(config: RedisConfig = {}): Promise<RedisConnection> {
  // Try to connect to Redis
  try {
    const testClient = createRedisClient(config);
    await testClient.connect();
    await testClient.ping();
    await testClient.quit();

    // Redis is available
    console.log("Redis connected successfully");
    const cache = new RedisCache(createRedisClient(config));
    const pubsub = new RedisPubSub(config);

    return {
      cache,
      pubsub,
      isConnected: true,
      close: async () => {
        await cache.quit();
        await pubsub.quit();
      },
    };
  } catch (error) {
    // Redis unavailable, use in-memory fallback
    console.log("Redis unavailable, using in-memory fallback");
    const cache = new MemoryCache();
    const pubsub = new MemoryPubSub();

    return {
      cache,
      pubsub,
      isConnected: false,
      close: async () => {
        await cache.quit();
        await pubsub.quit();
      },
    };
  }
}
