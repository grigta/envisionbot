# API Schema Validation

This directory contains Zod schemas for validating API request bodies in the Fastify server.

## Overview

All POST, PATCH, and PUT endpoints now have input validation using [Zod](https://zod.dev/), a TypeScript-first schema validation library.

## Files

### `api.schemas.ts`

Contains all validation schemas organized by API domain:

- **Auth**: Login with access codes
- **Projects**: Create/update projects with repo validation
- **Tasks**: Status and kanban status updates
- **Agent**: Agent prompt execution
- **Ideas**: Create/launch ideas with validation
- **Chat**: Message and session management
- **News**: Crawl triggering and analysis
- **Crawler**: Source management and testing
- **Competitors**: Competitor analysis and crawling

### `../middleware/validation.ts`

Provides reusable validation middleware functions:

- `validateBody(schema)` - Validates request body
- `validateQuery(schema)` - Validates query parameters
- `validateParams(schema)` - Validates URL parameters

## Usage

### In Route Handlers

```typescript
import { validateBody } from "./middleware/validation.js";
import * as schemas from "./schemas/api.schemas.js";

// Apply validation to a route
fastify.post<{ Body: schemas.CreateProjectRequest }>(
  "/api/projects",
  { preHandler: validateBody(schemas.CreateProjectSchema) },
  async (request, reply) => {
    // request.body is now validated and typed
    const { id, name, repo } = request.body;
    // ...
  }
);
```

### Error Responses

When validation fails, the API returns a 400 status with detailed error information:

```json
{
  "error": "Validation error",
  "details": [
    {
      "path": "repo",
      "message": "Repository must be in owner/repo format"
    },
    {
      "path": "name",
      "message": "Project name is required"
    }
  ]
}
```

## Validation Rules

### Common Patterns

- **Repository Format**: `owner/repo` format (e.g., `grigta/envisionbot`)
- **Domain Validation**: Valid domain names for competitors
- **URL Validation**: Full URL validation for crawler sources
- **Enum Validation**: Status fields validated against allowed values
- **String Length**: Min/max length constraints
- **Numeric Ranges**: Integer and range validation

### Example Schemas

#### Login Request
```typescript
{
  code: string (min: 1)
}
```

#### Create Project
```typescript
{
  id: string (min: 1),
  name: string (min: 1),
  repo: string (pattern: owner/repo),
  phase?: "idea" | "planning" | "mvp" | "beta" | "launch" | "growth" | "maintenance",
  goals?: string[],
  focusAreas?: ("ci-cd" | "issues" | "prs" | "security" | "dependencies" | "performance")[]
}
```

#### Update Task Status
```typescript
{
  status: "pending" | "approved" | "rejected" | "in_progress" | "completed" | "failed"
}
```

## Adding New Schemas

1. Define the schema in `api.schemas.ts`:
```typescript
export const MyNewSchema = z.object({
  field: z.string().min(1, "Field is required"),
});

export type MyNewRequest = z.infer<typeof MyNewSchema>;
```

2. Import and use in route handler:
```typescript
import { MyNewSchema, type MyNewRequest } from "./schemas/api.schemas.js";

fastify.post<{ Body: MyNewRequest }>(
  "/api/my-endpoint",
  { preHandler: validateBody(MyNewSchema) },
  async (request, reply) => {
    // Validated request.body
  }
);
```

## Benefits

- **Type Safety**: Schemas generate TypeScript types automatically
- **Runtime Validation**: Catches invalid data before processing
- **Better Error Messages**: Clear, actionable validation errors
- **Security**: Prevents malformed input from reaching business logic
- **Documentation**: Schemas serve as API documentation
- **Consistency**: Centralized validation rules

## Migration Notes

Previously, endpoints used manual validation like:
```typescript
if (!code) {
  return reply.status(400).send({ error: "Access code is required" });
}
```

Now, validation is declarative and centralized:
```typescript
{ preHandler: validateBody(LoginRequestSchema) }
```

This ensures:
- Consistent error format across all endpoints
- No manual checks scattered in route handlers
- Type safety from schema to handler
