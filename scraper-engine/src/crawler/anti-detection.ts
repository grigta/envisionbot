import { ProxyConfiguration } from 'crawlee';
import type { CrawlConfig } from '../types.js';
import { USER_AGENTS } from '../types.js';

// ============================================
// USER AGENT ROTATION
// ============================================

/**
 * Get a random desktop User-Agent
 */
export function getRandomUserAgent(type: 'desktop' | 'mobile' = 'desktop'): string {
  const agents = USER_AGENTS[type];
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Get all available User-Agents
 */
export function getAllUserAgents(): string[] {
  return [...USER_AGENTS.desktop, ...USER_AGENTS.mobile];
}

// ============================================
// PROXY CONFIGURATION
// ============================================

/**
 * Parse proxy list from environment or config
 * Supports formats:
 * - http://user:pass@host:port
 * - socks5://user:pass@host:port
 * - host:port (defaults to http)
 */
export function parseProxyList(proxyString?: string): string[] {
  if (!proxyString) return [];

  return proxyString
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      // Add http:// if no protocol specified
      if (!p.startsWith('http://') && !p.startsWith('https://') && !p.startsWith('socks5://') && !p.startsWith('socks4://')) {
        return `http://${p}`;
      }
      return p;
    });
}

/**
 * Create Crawlee ProxyConfiguration from config
 */
export function createProxyConfiguration(config: CrawlConfig): ProxyConfiguration | undefined {
  if (!config.proxyRotation || !config.proxyList?.length) {
    return undefined;
  }

  return new ProxyConfiguration({
    proxyUrls: config.proxyList,
  });
}

// ============================================
// DELAY MANAGEMENT
// ============================================

/**
 * Calculate random delay between min and max
 */
export function calculateDelay(minDelay: number, maxDelay: number): number {
  return minDelay + Math.random() * (maxDelay - minDelay);
}

/**
 * Sleep for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute function with random delay
 */
export async function withDelay<T>(
  fn: () => Promise<T>,
  minDelay: number,
  maxDelay: number
): Promise<T> {
  const waitTime = calculateDelay(minDelay, maxDelay);
  await delay(waitTime);
  return fn();
}

// ============================================
// BROWSER FINGERPRINT EVASION
// ============================================

/**
 * Script to inject for navigator overrides
 */
export const FINGERPRINT_EVASION_SCRIPT = `
  // Override webdriver detection
  Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
  });

  // Override languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en', 'ru'],
  });

  // Override plugins (make it look like a real browser)
  Object.defineProperty(navigator, 'plugins', {
    get: () => [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
      { name: 'Native Client', filename: 'internal-nacl-plugin' },
    ],
  });

  // Override permissions
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters);

  // Override chrome runtime
  window.chrome = {
    runtime: {},
  };

  // Override connection rtt
  if (navigator.connection) {
    Object.defineProperty(navigator.connection, 'rtt', {
      get: () => 50,
    });
  }
`;

/**
 * Get browser launch arguments for stealth
 */
export function getStealthLaunchArgs(): string[] {
  return [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-site-isolation-trials',
    '--disable-web-security',
    '--disable-features=BlockInsecurePrivateNetworkRequests',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--disable-popup-blocking',
    '--disable-translate',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-device-discovery-notifications',
    '--disable-backgrounding-occluded-windows',
  ];
}

// ============================================
// REQUEST HEADERS
// ============================================

/**
 * Get common headers that mimic real browser
 */
export function getCommonHeaders(userAgent?: string): Record<string, string> {
  return {
    'User-Agent': userAgent || getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };
}

/**
 * Get referer header based on domain
 */
export function getRefererForDomain(domain: string): string {
  // Simulate coming from Google search
  return `https://www.google.com/search?q=${encodeURIComponent(domain)}`;
}

// ============================================
// ROBOTS.TXT HANDLING
// ============================================

export interface RobotsTxtRules {
  allowed: string[];
  disallowed: string[];
  crawlDelay?: number;
  sitemaps: string[];
}

/**
 * Parse robots.txt content
 */
export function parseRobotsTxt(content: string): RobotsTxtRules {
  const rules: RobotsTxtRules = {
    allowed: [],
    disallowed: [],
    sitemaps: [],
  };

  let isRelevantUserAgent = false;
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim().toLowerCase();

    // Check for User-agent
    if (trimmedLine.startsWith('user-agent:')) {
      const agent = trimmedLine.slice('user-agent:'.length).trim();
      isRelevantUserAgent = agent === '*' || agent.includes('bot');
    }

    // Skip if not relevant user-agent block
    if (!isRelevantUserAgent) continue;

    // Parse Allow
    if (trimmedLine.startsWith('allow:')) {
      const path = line.slice(line.indexOf(':') + 1).trim();
      if (path) rules.allowed.push(path);
    }

    // Parse Disallow
    if (trimmedLine.startsWith('disallow:')) {
      const path = line.slice(line.indexOf(':') + 1).trim();
      if (path) rules.disallowed.push(path);
    }

    // Parse Crawl-delay
    if (trimmedLine.startsWith('crawl-delay:')) {
      const delay = parseFloat(line.slice(line.indexOf(':') + 1).trim());
      if (!isNaN(delay)) rules.crawlDelay = delay * 1000; // Convert to ms
    }

    // Parse Sitemap (always process)
    if (trimmedLine.startsWith('sitemap:')) {
      const sitemap = line.slice(line.indexOf(':') + 1).trim();
      if (sitemap) rules.sitemaps.push(sitemap);
    }
  }

  return rules;
}

/**
 * Check if URL is allowed by robots.txt rules
 */
export function isUrlAllowed(url: string, rules: RobotsTxtRules): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Check disallowed first (more specific wins)
    for (const disallowed of rules.disallowed) {
      if (path.startsWith(disallowed)) {
        // Check if there's a more specific allow rule
        for (const allowed of rules.allowed) {
          if (path.startsWith(allowed) && allowed.length > disallowed.length) {
            return true;
          }
        }
        return false;
      }
    }

    return true;
  } catch {
    return true; // Allow if URL parsing fails
  }
}

// ============================================
// RATE LIMITER
// ============================================

export class RateLimiter {
  private lastRequest: number = 0;
  private requestCount: number = 0;
  private windowStart: number = Date.now();

  constructor(
    private minDelay: number,
    private maxDelay: number,
    private maxRequestsPerMinute: number
  ) {}

  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Reset counter every minute
    if (now - this.windowStart > 60000) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    // Wait if we've exceeded rate limit
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.windowStart);
      if (waitTime > 0) {
        await delay(waitTime);
        this.windowStart = Date.now();
        this.requestCount = 0;
      }
    }

    // Apply random delay between requests
    const timeSinceLastRequest = now - this.lastRequest;
    const randomDelay = calculateDelay(this.minDelay, this.maxDelay);

    if (timeSinceLastRequest < randomDelay) {
      await delay(randomDelay - timeSinceLastRequest);
    }

    this.lastRequest = Date.now();
    this.requestCount++;
  }
}
