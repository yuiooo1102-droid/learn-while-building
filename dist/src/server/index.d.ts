import Fastify from "fastify";
export declare function createServer(): Promise<{
    app: Fastify.FastifyInstance<import("node:http").Server<typeof import("node:http").IncomingMessage, typeof import("node:http").ServerResponse>, import("node:http").IncomingMessage, import("node:http").ServerResponse<import("node:http").IncomingMessage>, Fastify.FastifyBaseLogger, Fastify.FastifyTypeProviderDefault> & PromiseLike<Fastify.FastifyInstance<import("node:http").Server<typeof import("node:http").IncomingMessage, typeof import("node:http").ServerResponse>, import("node:http").IncomingMessage, import("node:http").ServerResponse<import("node:http").IncomingMessage>, Fastify.FastifyBaseLogger, Fastify.FastifyTypeProviderDefault>> & {
        __linterBrands: "SafePromiseLike";
    };
    port: number;
}>;
export declare function startServer(): Promise<Fastify.FastifyInstance<import("node:http").Server<typeof import("node:http").IncomingMessage, typeof import("node:http").ServerResponse>, import("node:http").IncomingMessage, import("node:http").ServerResponse<import("node:http").IncomingMessage>, Fastify.FastifyBaseLogger, Fastify.FastifyTypeProviderDefault>>;
