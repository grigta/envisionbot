# GitHub API Cache

## Overview

The GitHub API cache layer reduces the load on GitHub's API by caching responses from read operations. This helps avoid rate limiting and improves performance for frequently accessed data.

## Architecture

The cache system consists of:

1. **GitHubCacheService**: Core caching logic with configurable TTL per command type
2. **GitHub Tools Integration**: Transparent caching in the `gh()` helper function
3. **Storage Backend**: Uses Redis when available, falls back to in-memory cache

## Features

### Intelligent Caching

- ✅ **Read operations are cached**: repo status, issue lists, PR lists, workflow runs
- ✅ **Write operations bypass cache**: create, edit, delete, comment operations
- ✅ **Configurable TTL**: Different cache durations for different command types
- ✅ **Automatic invalidation**: Cache entries expire based on TTL

### Cache Key Generation

Cache keys are generated based on:
- Command type (repo, issue, pr, run)
- Repository name
- MD5 hash of full command arguments (first 8 characters)

Example: `gh:issue:owner/repo:abc12345`

### Storage Backend

- **Redis**: When available, provides distributed caching across multiple instances
- **In-Memory**: Automatic fallback when Redis is unavailable

## Configuration

All configuration is done via environment variables:

```bash
# Enable/disable caching (default: true)
GITHUB_CACHE_ENABLED=true

# Default TTL for all commands (default: 300 seconds / 5 minutes)
GITHUB_CACHE_TTL=300

# Specific TTLs for different command types
GITHUB_CACHE_REPO_STATUS_TTL=300    # 5 minutes
GITHUB_CACHE_ISSUE_LIST_TTL=180     # 3 minutes
GITHUB_CACHE_PR_LIST_TTL=180        # 3 minutes
GITHUB_CACHE_WORKFLOW_RUN_TTL=120   # 2 minutes
GITHUB_CACHE_ISSUE_INFO_TTL=300     # 5 minutes
```

## Usage

### Automatic Usage

The cache is automatically used for all GitHub CLI commands in the `gh()` helper function. No code changes are required for existing tools.

```typescript
// Automatically cached if it's a read operation
const result = await gh(["repo", "view", "owner/repo", "--json", "name"]);

// Automatically bypasses cache (write operation)
const result = await gh(["issue", "create", "-R", "owner/repo", "--title", "Test"]);
```

### Manual Cache Control

You can access the cache service for manual operations:

```typescript
import { getGitHubCache } from "../tools/github.js";

const cache = getGitHubCache();

// Invalidate all cache entries for a repository
await cache.invalidateRepo("owner/repo");

// Invalidate all GitHub cache entries
await cache.invalidateAll();

// Get cache statistics
const stats = await cache.getStats();
console.log(`Total cached entries: ${stats.totalKeys}`);
console.log(`By command:`, stats.keysByCommand);
```

## Cache Invalidation

### Automatic Invalidation

Cache entries automatically expire based on their TTL. No manual invalidation is needed for normal operation.

### Manual Invalidation

You may want to manually invalidate cache in certain scenarios:

```typescript
// After creating/updating an issue, invalidate that repository's cache
await cache.invalidateRepo("owner/repo");

// Clear all GitHub cache (e.g., after configuration changes)
await cache.invalidateAll();
```

## Monitoring

### Cache Statistics

```typescript
const stats = await cache.getStats();

// Output:
// {
//   totalKeys: 42,
//   keysByCommand: {
//     repo: 5,
//     issue: 20,
//     pr: 12,
//     run: 5
//   }
// }
```

### Cache Hit/Miss Logging

The cache service logs cache hits and misses:

```
GitHub cache hit: repo view owner/repo --json name
GitHub cache miss: issue list -R owner/repo --state open
```

## Performance Benefits

### Rate Limit Savings

Without cache:
- 10 requests/minute to list issues → 10 API calls

With cache (3-minute TTL):
- 10 requests/minute to list issues → 1 API call every 3 minutes

### Response Time

- Cache hit: ~1ms (Redis) or ~0.1ms (in-memory)
- Cache miss: 200-500ms (GitHub API call)

## Testing

The cache service includes comprehensive tests:

```bash
npm test -- src/services/github-cache.service.test.ts
```

Test coverage includes:
- Cache hit/miss behavior
- Write operation bypass
- TTL configuration
- Cache key generation
- Invalidation operations
- Statistics gathering

## Troubleshooting

### Cache Not Working

1. Check if caching is enabled:
   ```bash
   echo $GITHUB_CACHE_ENABLED
   ```

2. Check cache statistics:
   ```typescript
   const cache = getGitHubCache();
   const stats = await cache.getStats();
   console.log(stats);
   ```

3. Verify Redis connection (or fallback to in-memory):
   ```
   Store initialized with SQLite + Redis
   # or
   Store initialized with SQLite (Redis unavailable, using memory cache)
   ```

### High Memory Usage

If using in-memory cache with high request volume, consider:
- Reducing TTL values
- Enabling Redis for distributed caching
- Adjusting cache size limits (future enhancement)

### Stale Data

If seeing stale data:
- Reduce TTL for that command type
- Manually invalidate cache for affected repositories
- Disable caching temporarily with `GITHUB_CACHE_ENABLED=false`

## Future Enhancements

Potential improvements:
- Cache size limits (LRU eviction)
- Smart invalidation on write operations
- Cache warming for frequently accessed data
- Metrics dashboard for cache performance
- Per-repository cache TTL configuration
