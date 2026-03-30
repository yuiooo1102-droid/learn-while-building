// src/server/index.ts
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import Anthropic from "@anthropic-ai/sdk";
import type { HookEvent, WatchMessage } from "../types.js";
import { parseHookEvent, createDebouncer } from "./hook-handler.js";
import { hasTemplate, getTemplate } from "../teaching/templates.js";
import { generateTeaching } from "../teaching/generator.js";
import {
  loadKnowledge,
  saveKnowledge,
  updateConcept,
} from "../teaching/knowledge.js";
import { createSession, addStep, getRecentSteps } from "../teaching/session.js";
import { homedir } from "node:os";
import { join } from "node:path";

const KNOWLEDGE_PATH = join(homedir(), ".learn-while-building", "knowledge.json");
const PORT = 3579;

export async function createServer() {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);

  const clients = new Set<WebSocket>();
  let session = createSession();
  let knowledge = await loadKnowledge(KNOWLEDGE_PATH);
  const anthropic = new Anthropic();
  const debouncer = createDebouncer<HookEvent>(300);

  function broadcast(message: WatchMessage) {
    const data = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  async function processEvent(event: HookEvent) {
    const toolInput = event.tool_input as Record<string, unknown>;

    // Try static template first
    if (hasTemplate(event.tool_name, toolInput)) {
      const content = getTemplate(event.tool_name, toolInput);
      if (content) {
        broadcast(content);
        for (const concept of content.concepts) {
          knowledge = updateConcept(knowledge, concept.name);
        }
        await saveKnowledge(KNOWLEDGE_PATH, knowledge);
        session = addStep(session, {
          toolName: event.tool_name,
          summary: content.title,
          timestamp: event.timestamp ?? new Date().toISOString(),
        });
        return;
      }
    }

    // Use LLM for complex operations
    broadcast({ type: "loading", title: `AI 正在: ${event.tool_name}...` });

    try {
      const recentSteps = getRecentSteps(session, 3);
      const content = await generateTeaching(
        anthropic,
        event,
        knowledge,
        recentSteps,
      );

      broadcast(content);

      for (const concept of content.concepts) {
        knowledge = updateConcept(knowledge, concept.name, concept.level);
      }
      await saveKnowledge(KNOWLEDGE_PATH, knowledge);

      session = addStep(session, {
        toolName: event.tool_name,
        summary: content.title,
        timestamp: event.timestamp ?? new Date().toISOString(),
      });
    } catch (err) {
      broadcast({
        type: "status",
        message: `教学内容生成失败: ${String(err)}`,
      });
    }
  }

  // HTTP hook endpoint
  app.post("/event", async (request, reply) => {
    const event = parseHookEvent(request.body);
    if (!event) {
      return reply.status(400).send({ error: "Invalid event" });
    }

    debouncer.push(event, (e) => {
      processEvent(e).catch(console.error);
    });

    return reply.status(200).send();
  });

  // WebSocket endpoint for lwb watch clients
  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(
      JSON.stringify({ type: "status", message: "已连接到教学服务" }),
    );

    socket.on("close", () => {
      clients.delete(socket);
    });
  });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  return { app, port: PORT };
}

export async function startServer() {
  const { app, port } = await createServer();
  await app.listen({ port, host: "127.0.0.1" });
  console.log(`Learn While Building server running on http://127.0.0.1:${port}`);
  return app;
}
