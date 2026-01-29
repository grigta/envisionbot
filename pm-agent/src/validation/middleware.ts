import type { FastifyRequest, FastifyReply } from "fastify";
import type { ZodSchema, ZodError } from "zod";

/**
 * Validation error response format
 */
interface ValidationError {
  error: string;
  details?: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Formats Zod validation errors into a user-friendly format
 */
function formatZodError(error: ZodError): ValidationError {
  return {
    error: "Validation failed",
    details: error.errors.map((err) => ({
      path: err.path.join("."),
      message: err.message,
    })),
  };
}

/**
 * Validates request body against a Zod schema
 */
export async function validateBody<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: ZodSchema<T>
): Promise<T | null> {
  try {
    return schema.parse(request.body);
  } catch (error) {
    if (error && typeof error === "object" && "errors" in error) {
      reply.status(400).send(formatZodError(error as ZodError));
      return null;
    }
    reply.status(400).send({ error: "Invalid request body" });
    return null;
  }
}

/**
 * Validates request query parameters against a Zod schema
 */
export async function validateQuery<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: ZodSchema<T>
): Promise<T | null> {
  try {
    return schema.parse(request.query);
  } catch (error) {
    if (error && typeof error === "object" && "errors" in error) {
      reply.status(400).send(formatZodError(error as ZodError));
      return null;
    }
    reply.status(400).send({ error: "Invalid query parameters" });
    return null;
  }
}

/**
 * Validates request params against a Zod schema
 */
export async function validateParams<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: ZodSchema<T>
): Promise<T | null> {
  try {
    return schema.parse(request.params);
  } catch (error) {
    if (error && typeof error === "object" && "errors" in error) {
      reply.status(400).send(formatZodError(error as ZodError));
      return null;
    }
    reply.status(400).send({ error: "Invalid URL parameters" });
    return null;
  }
}

/**
 * Helper to validate all three (params, query, body) at once
 * Returns null if any validation fails (response already sent)
 */
export async function validateAll<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown
>(
  request: FastifyRequest,
  reply: FastifyReply,
  schemas: {
    params?: ZodSchema<TParams>;
    query?: ZodSchema<TQuery>;
    body?: ZodSchema<TBody>;
  }
): Promise<{
  params: TParams;
  query: TQuery;
  body: TBody;
} | null> {
  let params: TParams | undefined = undefined as TParams;
  let query: TQuery | undefined = undefined as TQuery;
  let body: TBody | undefined = undefined as TBody;

  if (schemas.params) {
    const validated = await validateParams(request, reply, schemas.params);
    if (validated === null) return null;
    params = validated;
  }

  if (schemas.query) {
    const validated = await validateQuery(request, reply, schemas.query);
    if (validated === null) return null;
    query = validated;
  }

  if (schemas.body) {
    const validated = await validateBody(request, reply, schemas.body);
    if (validated === null) return null;
    body = validated;
  }

  return { params: params!, query: query!, body: body! };
}
