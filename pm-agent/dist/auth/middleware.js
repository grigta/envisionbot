/**
 * Fastify authentication middleware
 */
import { verifyToken } from "./jwt.js";
import { AuthRepository } from "../repositories/auth.repository.js";
// Public routes that don't require authentication
const PUBLIC_ROUTES = [
    "/api/auth/login",
    "/api/auth/validate",
    "/api/health",
];
// Check if a route is public
function isPublicRoute(url) {
    return PUBLIC_ROUTES.some((route) => url.startsWith(route));
}
/**
 * Create the auth hook for Fastify
 */
export function createAuthHook(deps) {
    const authRepo = new AuthRepository(deps);
    return async function authHook(request, reply) {
        // Skip auth for public routes
        if (isPublicRoute(request.url)) {
            return;
        }
        // Skip auth for WebSocket upgrade requests (handled separately)
        if (request.url.startsWith("/ws/")) {
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
        }
        catch (error) {
            return reply.status(401).send({
                error: "Invalid or expired token",
            });
        }
    };
}
//# sourceMappingURL=middleware.js.map