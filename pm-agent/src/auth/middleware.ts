/**
 * Fastify authentication middleware
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "./jwt.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import type { RepositoryDeps } from "../db/index.js";

// Extend FastifyRequest to include user
declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      name: string;
      role: string;
    };
  }
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/validate",
  "/api/health",
];

// Check if a route is public
function isPublicRoute(url: string): boolean {
  return PUBLIC_ROUTES.some((route) => url.startsWith(route));
}

/**
 * Create the auth hook for Fastify
 */
export function createAuthHook(deps: RepositoryDeps) {
  const authRepo = new AuthRepository(deps);

  return async function authHook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Skip auth for public routes
    if (isPublicRoute(request.url)) {
      return;
    }

    // Skip auth for WebSocket upgrade requests (auth handled in WebSocket handler)
    if (request.headers.upgrade === "websocket") {
      return;
    }

    // Get authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    try {
      // Verify token
      const payload = verifyToken(token);

      // Check if token is revoked
      const isRevoked = await authRepo.isTokenRevoked(payload.jti);
      if (isRevoked) {
        return reply.status(401).send({
          error: "Token has been revoked",
        });
      }

      // Attach user to request
      request.user = {
        id: payload.sub,
        name: payload.name,
        role: payload.role,
      };
    } catch (error) {
      return reply.status(401).send({
        error: "Invalid or expired token",
      });
    }
  };
}
