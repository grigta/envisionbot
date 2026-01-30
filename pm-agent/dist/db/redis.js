/**
 * Redis connection with in-memory fallback
 * When Redis is unavailable, uses Map-based cache and EventEmitter for pub/sub
 */
import { Redis } from "ioredis";
import { EventEmitter } from "node:events";
/**
 * In-memory cache implementation (fallback when Redis unavailable)
 */
class MemoryCache {
    cache = new Map();
    counters = new Map();
    async get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }
    async set(key, value, ttl) {
        const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
        this.cache.set(key, { value, expiresAt });
    }
    async setex(key, ttl, value) {
        await this.set(key, value, ttl);
    }
    async del(...keys) {
        let deleted = 0;
        for (const key of keys) {
            if (this.cache.delete(key))
                deleted++;
        }
        return deleted;
    }
    async keys(pattern) {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
        const result = [];
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
    async incr(key) {
        const current = this.counters.get(key) ?? 0;
        const next = current + 1;
        this.counters.set(key, next);
        return next;
    }
    async expire(key, seconds) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        entry.expiresAt = Date.now() + seconds * 1000;
        return true;
    }
    async quit() {
        this.cache.clear();
        this.counters.clear();
    }
}
/**
 * In-memory pub/sub implementation
 */
class MemoryPubSub {
    emitter = new EventEmitter();
    async publish(channel, message) {
        this.emitter.emit(channel, message);
        return this.emitter.listenerCount(channel);
    }
    subscribe(channel, handler) {
        this.emitter.on(channel, handler);
        return () => {
            this.emitter.off(channel, handler);
        };
    }
    async quit() {
        this.emitter.removeAllListeners();
    }
}
/**
 * Redis cache wrapper
 */
class RedisCache {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async get(key) {
        return this.redis.get(key);
    }
    async set(key, value, ttl) {
        if (ttl) {
            await this.redis.setex(key, ttl, value);
        }
        else {
            await this.redis.set(key, value);
        }
    }
    async setex(key, ttl, value) {
        await this.redis.setex(key, ttl, value);
    }
    async del(...keys) {
        if (keys.length === 0)
            return 0;
        return this.redis.del(...keys);
    }
    async keys(pattern) {
        return this.redis.keys(pattern);
    }
    async incr(key) {
        return this.redis.incr(key);
    }
    async expire(key, seconds) {
        const result = await this.redis.expire(key, seconds);
        return result === 1;
    }
    async quit() {
        await this.redis.quit();
    }
}
/**
 * Redis pub/sub wrapper
 */
class RedisPubSub {
    publisher;
    subscriber;
    handlers = new Map();
    constructor(config) {
        this.publisher = createRedisClient(config);
        this.subscriber = createRedisClient(config);
        this.subscriber.on("message", (channel, message) => {
            const channelHandlers = this.handlers.get(channel);
            if (channelHandlers) {
                for (const handler of channelHandlers) {
                    try {
                        handler(message);
                    }
                    catch (error) {
                        console.error(`Pub/sub handler error on ${channel}:`, error);
                    }
                }
            }
        });
    }
    async publish(channel, message) {
        return this.publisher.publish(channel, message);
    }
    subscribe(channel, handler) {
        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, new Set());
            this.subscriber.subscribe(channel);
        }
        const handlers = this.handlers.get(channel);
        handlers.add(handler);
        return () => {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.subscriber.unsubscribe(channel);
                this.handlers.delete(channel);
            }
        };
    }
    async quit() {
        await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
    }
}
/**
 * Create Redis client
 */
function createRedisClient(config) {
    if (config.url) {
        return new Redis(config.url);
    }
    return new Redis({
        host: config.host || "localhost",
        port: config.port || 6379,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
            if (times > 3)
                return null; // Stop retrying
            return Math.min(times * 200, 2000);
        },
    });
}
/**
 * Initialize Redis connection with fallback to in-memory
 */
export async function initRedis(config = {}) {
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
    }
    catch (error) {
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
//# sourceMappingURL=redis.js.map