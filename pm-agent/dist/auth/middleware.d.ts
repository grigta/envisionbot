/**
 * Fastify authentication middleware
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import type { RepositoryDeps } from "../db/index.js";
declare module "fastify" {
    interface FastifyRequest {
        user?: {
            id: string;
            name: string;
            role: string;
        };
    }
}
/**
 * Create the auth hook for Fastify
 */
export declare function createAuthHook(deps: RepositoryDeps): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
//# sourceMappingURL=middleware.d.ts.map