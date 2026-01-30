import { vi } from 'vitest';

// Mock environment variables
process.env.ANTHROPIC_API_KEY = 'test-api-key';
process.env.DATABASE_PATH = ':memory:';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Global test utilities
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const createMockDate = (isoString: string) => {
  return new Date(isoString);
};

// Mock console to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: console.error, // Keep errors visible
};
