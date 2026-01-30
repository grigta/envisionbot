# Testing Guide

## Overview

This project uses [Vitest](https://vitest.dev/) as the testing framework. Vitest provides a fast, modern testing experience with native TypeScript support.

## Running Tests

```bash
# Run tests in watch mode (for development)
npm test

# Run tests once (for CI)
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

Tests are organized alongside the source code with the `.test.ts` extension:

```
src/
├── agent.ts
├── agent.test.ts
├── state/
│   ├── store.ts
│   └── store.test.ts
├── tools/
│   ├── github.ts
│   └── github.test.ts
└── approval/
    ├── queue.ts
    └── queue.test.ts
```

## Test Categories

### Unit Tests
- **Store Tests** (`src/state/store.test.ts`): Tests for database CRUD operations, stats, and persistence
- **Agent Tests** (`src/agent.test.ts`): Tests for AI agent logic, parsing, and task extraction
- **GitHub Tools Tests** (`src/tools/github.test.ts`): Tests for GitHub CLI integration
- **Approval Queue Tests** (`src/approval/queue.test.ts`): Tests for approval workflow

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyModule', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Mocking

```typescript
// Mock modules
vi.mock('../path/to/module', () => ({
  myFunction: vi.fn(),
}));

// Mock implementations
import { myFunction } from '../path/to/module';
vi.mocked(myFunction).mockReturnValue('mocked result');
```

### Test Utilities

Common test utilities and mocks are available in `src/test/`:
- `setup.ts`: Global test setup and environment configuration
- `mocks.ts`: Reusable mock factories and test data generators

## Coverage

Test coverage reports are generated in the `coverage/` directory. The coverage report includes:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

View coverage in HTML format by opening `coverage/index.html` in a browser after running `npm run test:coverage`.

## CI/CD

Tests run automatically on every push and pull request via GitHub Actions. The workflow:
1. Runs type checking
2. Executes all unit tests
3. Generates coverage reports
4. Uploads coverage to Codecov (if configured)

## Best Practices

1. **Test Naming**: Use descriptive test names that explain what is being tested
   ```typescript
   it('should return error when action not found', () => { ... });
   ```

2. **Arrange-Act-Assert**: Follow the AAA pattern for clear test structure

3. **Isolation**: Each test should be independent and not rely on other tests

4. **Mocking**: Mock external dependencies (database, APIs, file system) to keep tests fast and reliable

5. **Coverage**: Aim for high coverage of critical business logic (agent, store, approval queue)

6. **Edge Cases**: Test error conditions, boundary values, and edge cases

## Debugging Tests

### Run specific test file
```bash
npm test src/agent.test.ts
```

### Run specific test
```bash
npm test -t "should parse JSON from markdown"
```

### Debug with VS Code
Add this to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--run"],
  "console": "integratedTerminal"
}
```

## Troubleshooting

### Tests are slow
- Check for unnecessary async operations
- Ensure mocks are properly set up
- Use in-memory database for store tests

### Flaky tests
- Avoid time-dependent tests
- Properly clear mocks between tests
- Ensure test isolation

### Import errors
- Check that paths use `.js` extension for ES modules
- Verify mock paths match actual module paths
- Ensure TypeScript types are available
