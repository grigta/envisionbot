import { ProxyConfiguration } from 'crawlee';
import type { CrawlConfig } from '../types.js';
/**
 * Get a random desktop User-Agent
 */
export declare function getRandomUserAgent(type?: 'desktop' | 'mobile'): string;
/**
 * Get all available User-Agents
 */
export declare function getAllUserAgents(): string[];
/**
 * Parse proxy list from environment or config
 * Supports formats:
 * - http://user:pass@host:port
 * - socks5://user:pass@host:port
 * - host:port (defaults to http)
 */
export declare function parseProxyList(proxyString?: string): string[];
/**
 * Create Crawlee ProxyConfiguration from config
 */
export declare function createProxyConfiguration(config: CrawlConfig): ProxyConfiguration | undefined;
/**
 * Calculate random delay between min and max
 */
export declare function calculateDelay(minDelay: number, maxDelay: number): number;
/**
 * Sleep for specified milliseconds
 */
export declare function delay(ms: number): Promise<void>;
/**
 * Execute function with random delay
 */
export declare function withDelay<T>(fn: () => Promise<T>, minDelay: number, maxDelay: number): Promise<T>;
/**
 * Script to inject for navigator overrides
 */
export declare const FINGERPRINT_EVASION_SCRIPT = "\n  // Override webdriver detection\n  Object.defineProperty(navigator, 'webdriver', {\n    get: () => false,\n  });\n\n  // Override languages\n  Object.defineProperty(navigator, 'languages', {\n    get: () => ['en-US', 'en', 'ru'],\n  });\n\n  // Override plugins (make it look like a real browser)\n  Object.defineProperty(navigator, 'plugins', {\n    get: () => [\n      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },\n      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },\n      { name: 'Native Client', filename: 'internal-nacl-plugin' },\n    ],\n  });\n\n  // Override permissions\n  const originalQuery = window.navigator.permissions.query;\n  window.navigator.permissions.query = (parameters) =>\n    parameters.name === 'notifications'\n      ? Promise.resolve({ state: Notification.permission })\n      : originalQuery(parameters);\n\n  // Override chrome runtime\n  window.chrome = {\n    runtime: {},\n  };\n\n  // Override connection rtt\n  if (navigator.connection) {\n    Object.defineProperty(navigator.connection, 'rtt', {\n      get: () => 50,\n    });\n  }\n";
/**
 * Get browser launch arguments for stealth
 */
export declare function getStealthLaunchArgs(): string[];
/**
 * Get common headers that mimic real browser
 */
export declare function getCommonHeaders(userAgent?: string): Record<string, string>;
/**
 * Get referer header based on domain
 */
export declare function getRefererForDomain(domain: string): string;
export interface RobotsTxtRules {
    allowed: string[];
    disallowed: string[];
    crawlDelay?: number;
    sitemaps: string[];
}
/**
 * Parse robots.txt content
 */
export declare function parseRobotsTxt(content: string): RobotsTxtRules;
/**
 * Check if URL is allowed by robots.txt rules
 */
export declare function isUrlAllowed(url: string, rules: RobotsTxtRules): boolean;
export declare class RateLimiter {
    private minDelay;
    private maxDelay;
    private maxRequestsPerMinute;
    private lastRequest;
    private requestCount;
    private windowStart;
    constructor(minDelay: number, maxDelay: number, maxRequestsPerMinute: number);
    waitForSlot(): Promise<void>;
}
//# sourceMappingURL=anti-detection.d.ts.map