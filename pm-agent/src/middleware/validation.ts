import type { FastifyRequest, FastifyReply } from "fastify";
import type { ZodSchema, ZodError } from "zod";

/**
 * Validation middleware factory for Fastify routes
 * Validates request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Parse and validate the request body
      request.body = schema.parse(request.body);
    } catch (error) {
      // Handle Zod validation errors
      if (error && typeof error === "object" && "errors" in error) {
        const zodError = error as ZodError;
        const formattedErrors = zodError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        return reply.status(400).send({
          error: "Validation error",
          details: formattedErrors,
        });
      }

      // Handle other errors
      return reply.status(400).send({
        error: "Invalid request body",
      });
    }
  };
}

/**
 * Validation middleware for query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.query = schema.parse(request.query);
    } catch (error) {
      if (error && typeof error === "object" && "errors" in error) {
        const zodError = error as ZodError;
        const formattedErrors = zodError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        return reply.status(400).send({
          error: "Validation error",
          details: formattedErrors,
        });
      }

      return reply.status(400).send({
        error: "Invalid query parameters",
      });
    }
  };
}

/**
 * Validation middleware for URL parameters
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.params = schema.parse(request.params);
    } catch (error) {
      if (error && typeof error === "object" && "errors" in error) {
        const zodError = error as ZodError;
        const formattedErrors = zodError.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        return reply.status(400).send({
          error: "Validation error",
          details: formattedErrors,
        });
      }

      return reply.status(400).send({
        error: "Invalid URL parameters",
      });
    }
  };
}
