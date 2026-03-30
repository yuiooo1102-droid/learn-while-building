// tests/integration.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { createServer } from "../src/server/index.js";
import type { FastifyInstance } from "fastify";

describe("Server integration", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("health check returns ok", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("rejects invalid hook events", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "POST",
      url: "/event",
      payload: { invalid: true },
    });

    expect(response.statusCode).toBe(400);
  });

  it("accepts valid hook events", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "POST",
      url: "/event",
      payload: {
        session_id: "s1",
        hook_event_name: "PostToolUse",
        tool_name: "Read",
        tool_input: { file_path: "/src/index.ts" },
        tool_response: { content: "hello" },
        tool_use_id: "t1",
        cwd: "/project",
      },
    });

    expect(response.statusCode).toBe(200);
  });
});
