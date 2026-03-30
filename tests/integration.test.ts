// tests/integration.test.ts
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createServer } from "../src/server/index.js";
import type { FastifyInstance } from "fastify";

const CONFIG_PATH = join(homedir(), ".learn-while-building", "config.json");

describe("Server integration", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await rm(CONFIG_PATH, { force: true });
  });

  afterEach(async () => {
    if (app) await app.close();
    await rm(CONFIG_PATH, { force: true });
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

  it("accepts teaching content via POST /teach", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "POST",
      url: "/teach",
      payload: {
        title: "变量声明",
        explanation: "const 声明一个不可变的变量",
        concepts: [{ name: "variable", label: "变量", level: 1 }],
        reasoning: "需要存储数据",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("returns default config", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "GET",
      url: "/config",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.model).toBe("claude-sonnet-4-6");
  });

  it("updates config model", async () => {
    const server = await createServer();
    app = server.app;
    await app.listen({ port: 0, host: "127.0.0.1" });

    const response = await app.inject({
      method: "POST",
      url: "/config",
      payload: { model: "claude-haiku-4-5-20251001" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().model).toBe("claude-haiku-4-5-20251001");

    const getResponse = await app.inject({
      method: "GET",
      url: "/config",
    });
    expect(getResponse.json().model).toBe("claude-haiku-4-5-20251001");
  });
});
