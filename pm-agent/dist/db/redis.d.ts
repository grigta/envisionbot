/**
 * Redis connection with in-memory fallback
 * When Redis is unavailable, uses Map-based cache and EventEmitter for pub/sub
 */
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
export interface RedisConnection {
    cache: CacheClient;
    pubsub: PubSubClient;
    isConnected: boolean;
    close: () => Promise<void>;
}
/**
 * Initialize Redis connection with fallback to in-memory
 */
export declare function initRedis(config?: RedisConfig): Promise<RedisConnection>;
//# sourceMappingURL=redis.d.ts.map