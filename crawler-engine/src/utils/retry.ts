/**
 * Retry utility with exponential backoff for handling API rate limits and temporary errors
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 60000) */
  maxDelay?: number;
  /** Exponential backoff factor (default: 2) */
  backoffFactor?: number;
  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;
  /** Function to determine if error should be retried (default: retries rate limits and temporary errors) */
  shouldRetry?: (error: unknown) => boolean;
  /** Callback for retry attempts */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

export interface RetryableError {
  statusCode?: number;
  status?: number;
  code?: string;
  message?: string;
}

/**
 * Default retry logic: retry on rate limits (429) and temporary server errors (500, 502, 503, 504)
 */
export function defaultShouldRetry(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as RetryableError;
  const statusCode = err.statusCode || err.status;

  // Retry on rate limits
  if (statusCode === 429) {
    return true;
  }

  // Retry on temporary server errors
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return true;
  }

  // Retry on network errors
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    return true;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  backoffFactor: number,
  maxDelay: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * (backoffFactor ^ attempt)
  let delay = initialDelay * Math.pow(backoffFactor, attempt);

  // Cap at maxDelay
  delay = Math.min(delay, maxDelay);

  // Add jitter to avoid thundering herd (random value between 0 and delay)
  if (jitter) {
    delay = Math.random() * delay;
  }

  return Math.floor(delay);
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise that resolves to the function result
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => await client.messages.create({ ... }),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 60000,
    backoffFactor = 2,
    jitter = true,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts or error is not retryable
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay for this attempt
      const delay = calculateDelay(attempt, initialDelay, backoffFactor, maxDelay, jitter);

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Extract rate limit reset time from error (if available)
 * Returns milliseconds to wait, or null if not found
 */
export function extractRateLimitReset(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const err = error as RetryableError & {
    headers?: Record<string, string>;
    response?: { headers?: Record<string, string> };
  };

  // Try to find rate limit reset header
  const headers = err.headers || err.response?.headers;
  if (!headers) {
    return null;
  }

  // Check common rate limit headers
  const resetHeader = headers['x-ratelimit-reset'] ||
                     headers['retry-after'] ||
                     headers['ratelimit-reset'];

  if (!resetHeader) {
    return null;
  }

  // Parse reset time
  const resetValue = parseInt(resetHeader, 10);
  if (isNaN(resetValue)) {
    return null;
  }

  // If value is a Unix timestamp, calculate time until reset
  // If value is seconds to wait, use directly
  if (resetValue > 1000000000) {
    // Unix timestamp
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, (resetValue - now) * 1000);
  } else {
    // Seconds to wait
    return resetValue * 1000;
  }
}
