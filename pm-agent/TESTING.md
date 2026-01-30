# Testing Guide

This document describes the testing approach, infrastructure, and best practices for the Envision CEO project.

## Test Framework

The project uses [Vitest](https://vitest.dev/) as the testing framework. Vitest is a fast, modern test runner built on top of Vite, offering:

- **Fast execution** with hot module reloading
- **TypeScript support** out of the box
- **Compatible API** with Jest
- **Built-in coverage** reporting with v8

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:ui
```

### Run tests once (CI mode)
```bash
npm run test:run
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- src/auth/jwt.test.ts
```

### Run tests matching a pattern
```bash
npm test -- --grep "JWT"
```

## Test Structure

### Test Files

Test files are co-located with the source code they test, using the naming convention:
- `*.test.ts` - Unit tests
- `*.spec.ts` - Integration tests (if needed)

Example structure:
```
src/
├── auth/
│   ├── jwt.ts
│   ├── jwt.test.ts
│   ├── access-code.ts
│   └── access-code.test.ts
├── chat/
│   ├── mentions.ts
│   └── mentions.test.ts
└── state/
    ├── store.ts
    └── store.test.ts
```

### Test Organization

Tests are organized using `describe` blocks for grouping related tests:

```typescript
describe('Module Name', () => {
  describe('functionName', () => {
    it('should do something specific', () => {
      // Test implementation
    });
  });
});
```

## Test Coverage

### Current Coverage

The project currently has test coverage for:

1. **Authentication Module** (`src/auth/`)
   - ✅ JWT utilities (14 tests)
   - ✅ Access code utilities (25 tests)

2. **Chat Module** (`src/chat/`)
   - ✅ Mention parsing and context building (29 tests)

3. **State Management** (`src/state/`)
   - ⚠️ Store (23 tests - needs updates for singleton pattern)

4. **Tools** (`src/tools/`)
   - ✅ GitHub tools (partial coverage)

### Coverage Goals

We aim for:
- **Critical paths**: 90%+ coverage
- **Business logic**: 80%+ coverage
- **Utilities**: 70%+ coverage
- **Overall project**: 60%+ coverage

## Writing Tests

### Unit Tests

Unit tests should:
- Test a single function or method
- Mock external dependencies
- Be fast and isolated
- Have clear, descriptive names

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { normalizeAccessCode } from './access-code';

describe('normalizeAccessCode', () => {
  it('should normalize code to uppercase with dashes', () => {
    expect(normalizeAccessCode('abcd-efgh-2345')).toBe('ABCD-EFGH-2345');
  });

  it('should return empty string for invalid length', () => {
    expect(normalizeAccessCode('ABC')).toBe('');
  });
});
```

### Integration Tests

Integration tests should:
- Test multiple components working together
- Use real dependencies when possible
- Test realistic scenarios
- May be slower than unit tests

Example:
```typescript
describe('Integration: Authentication Flow', () => {
  it('should complete full lifecycle: generate, hash, verify', async () => {
    const code = generateAccessCode();
    const hash = await hashAccessCode(code);
    expect(await compareAccessCode(code, hash)).toBe(true);
  });
});
```

### Mocking

The project uses Vitest's built-in mocking capabilities:

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('../state/store', () => ({
  store: {
    getProjectByName: vi.fn(),
    getProjects: vi.fn(),
  },
}));

// Mock implementation
vi.mocked(store.getProjectByName).mockReturnValue(mockProject);

// Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

### Test Data Factories

Reusable test data factories are available in `src/test/mocks.ts`:

```typescript
import { createTestProject, createTestTask } from '../test/mocks';

const project = createTestProject({ name: 'My Project' });
const task = createTestTask({ projectId: project.id });
```

## Best Practices

### 1. Use Descriptive Test Names

✅ Good:
```typescript
it('should normalize code to uppercase with dashes', () => {});
```

❌ Bad:
```typescript
it('works', () => {});
```

### 2. Follow AAA Pattern

Arrange, Act, Assert:

```typescript
it('should verify correct code against hash', async () => {
  // Arrange
  const code = 'ABCD-EFGH-2345';
  const hash = await hashAccessCode(code);

  // Act
  const result = await compareAccessCode(code, hash);

  // Assert
  expect(result).toBe(true);
});
```

### 3. Test Edge Cases

Always test:
- Valid inputs (happy path)
- Invalid inputs
- Boundary conditions
- Error conditions
- Empty/null/undefined values

### 4. Keep Tests Independent

Each test should:
- Set up its own data
- Clean up after itself
- Not depend on other tests
- Be runnable in isolation

### 5. Use beforeEach/afterEach Wisely

```typescript
describe('MyModule', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('should work with database', () => {
    // Test uses db
  });
});
```

### 6. Mock External Dependencies

Mock:
- File system operations
- Network requests
- Database calls (unless integration testing)
- External APIs
- Time-dependent functions

Don't mock:
- The code you're testing
- Simple utilities
- Standard library functions

## Test Configuration

### Vitest Config

The project's test configuration is in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types.ts',
        'src/index.ts',
        'src/scripts/**',
      ],
    },
    include: ['src/**/*.{test,spec}.ts'],
    testTimeout: 10000,
  },
});
```

### Environment Variables

Tests use environment variables set in `src/test/setup.ts`:

```typescript
process.env.ANTHROPIC_API_KEY = 'test-api-key';
process.env.DATABASE_PATH = ':memory:';
```

## Continuous Integration

Tests are run automatically on:
- Every push to main branch
- Every pull request
- Before deployment

CI configuration can be found in `.github/workflows/`.

## Troubleshooting

### Tests Fail Locally

1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Check environment variables are set correctly

3. Ensure database migrations have run

### Slow Tests

If tests are running slowly:
- Check for missing mocks (network calls, file operations)
- Look for unnecessary `await` statements
- Consider parallelization limits
- Use `vi.useFakeTimers()` for time-dependent tests

### Flaky Tests

If tests pass/fail intermittently:
- Check for race conditions
- Ensure tests are independent
- Look for shared state between tests
- Add proper cleanup in `afterEach`

## Coverage Reports

After running `npm run test:coverage`, coverage reports are available in:
- **Terminal**: Text summary
- **HTML**: `coverage/index.html` - Open in browser for detailed report
- **JSON**: `coverage/coverage-final.json` - For programmatic analysis

## Future Improvements

Planned testing improvements:
- [ ] Add integration tests for end-to-end flows
- [ ] Set up E2E testing for API endpoints
- [ ] Add performance/benchmark tests
- [ ] Increase coverage for repositories
- [ ] Add tests for services layer
- [ ] Set up mutation testing
- [ ] Add visual regression testing for UI components

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Mocking Patterns](https://vitest.dev/guide/mocking.html)

## Getting Help

If you have questions about testing:
1. Check this documentation
2. Review existing tests in the codebase
3. Consult the team in code reviews
4. Reach out in the #testing Slack channel
