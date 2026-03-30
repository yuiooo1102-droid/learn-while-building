// src/server/index.ts
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import Anthropic from "@anthropic-ai/sdk";
import type { HookEvent, WatchMessage, Exercise, ClientMessage } from "../types.js";
import { parseHookEvent, createDebouncer } from "./hook-handler.js";
import { hasTemplate, getTemplate } from "../teaching/templates.js";
import { generateTeaching } from "../teaching/generator.js";
import { generateExercise, judgeAnswer } from "../teaching/exercise.js";
import { shouldTriggerExercise } from "../teaching/trigger.js";
import { loadKnowledge, saveKnowledge, updateConcept } from "../teaching/knowledge.js";
import { loadConfig, saveConfig } from "../teaching/config.js";
import { createSession, addStep, getRecentSteps } from "../teaching/session.js";
import { homedir } from "node:os";
import { join } from "node:path";

const LWB_DIR = join(homedir(), ".learn-while-building");
const KNOWLEDGE_PATH = join(LWB_DIR, "knowledge.json");
const CONFIG_PATH = join(LWB_DIR, "config.json");
const PORT = 3579;

export async function createServer() {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);

  const clients = new Set<WebSocket>();
  let session = createSession();
  let knowledge = await loadKnowledge(KNOWLEDGE_PATH);
  let config = await loadConfig(CONFIG_PATH);
  const anthropic = new Anthropic();
  const debouncer = createDebouncer<HookEvent>(300);
  let pendingExercise: Exercise | null = null;
  let lastEvent: HookEvent | null = null;

  function broadcast(message: WatchMessage) {
    const data = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  async function handleAnswer(answer: string) {
    if (!pendingExercise || !lastEvent) return;

    try {
      const feedback = await judgeAnswer(anthropic, pendingExercise, answer, lastEvent, config.model);
      broadcast(feedback);

      for (const update of feedback.conceptUpdates) {
        knowledge = updateConcept(knowledge, update.name, update.newLevel);
      }
      await saveKnowledge(KNOWLEDGE_PATH, knowledge);
    } catch (err) {
      broadcast({ type: "status", message: `评判失败: ${String(err)}` });
    }

    pendingExercise = null;
  }

  async function tryTriggerExercise(
    event: HookEvent,
    teachingConcepts: ReadonlyArray<{ name: string; label: string; level: 0 | 1 | 2 | 3 }>,
    usedTemplate: boolean,
  ) {
    if (!shouldTriggerExercise(knowledge, teachingConcepts, usedTemplate)) return;

    try {
      const recentSteps = getRecentSteps(session, 3);
      const exercise = await generateExercise(anthropic, event, knowledge, recentSteps, config.model);
      pendingExercise = exercise;
      lastEvent = event;
      broadcast(exercise);
    } catch (err) {
      broadcast({ type: "status", message: `练习生成失败: ${String(err)}` });
    }
  }

  async function processEvent(event: HookEvent) {
    const toolInput = event.tool_input as Record<string, unknown>;
    lastEvent = event;

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
        await tryTriggerExercise(event, content.concepts, true);
        return;
      }
    }

    broadcast({ type: "loading", title: `AI 正在: ${event.tool_name}...` });

    try {
      const recentSteps = getRecentSteps(session, 3);
      const content = await generateTeaching(anthropic, event, knowledge, recentSteps, config.model);
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

      await tryTriggerExercise(event, content.concepts, false);
    } catch (err) {
      broadcast({ type: "status", message: `教学内容生成失败: ${String(err)}` });
    }
  }

  app.post("/event", async (request, reply) => {
    const event = parseHookEvent(request.body);
    if (!event) return reply.status(400).send({ error: "Invalid event" });
    debouncer.push(event, (e) => { processEvent(e).catch(console.error); });
    return reply.status(200).send();
  });

  app.post("/exercise/trigger", async (_request, reply) => {
    const recentSteps = getRecentSteps(session, 1);
    if (recentSteps.length === 0 && !lastEvent) {
      return reply.status(400).send({ error: "No context available" });
    }

    const event = lastEvent ?? {
      session_id: "manual", hook_event_name: "Manual", tool_name: "Manual",
      tool_input: {}, tool_response: {}, tool_use_id: "manual", cwd: "",
    };

    try {
      const exercise = await generateExercise(anthropic, event, knowledge, getRecentSteps(session, 3), config.model);
      pendingExercise = exercise;
      broadcast(exercise);
      return reply.status(200).send();
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.get("/config", async () => config);

  app.post("/config", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (typeof body.model === "string") {
      config = { ...config, model: body.model };
      await saveConfig(CONFIG_PATH, config);
    }
    return reply.status(200).send(config);
  });

  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: "status", message: "已连接到教学服务" }));

    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as ClientMessage;
        if (msg.type === "answer" && typeof msg.answer === "string") {
          handleAnswer(msg.answer).catch(console.error);
        }
      } catch { /* Ignore invalid messages */ }
    });

    socket.on("close", () => { clients.delete(socket); });
  });

  app.get("/health", async () => ({ status: "ok" }));

  return { app, port: PORT };
}

export async function startServer() {
  const { app, port } = await createServer();
  await app.listen({ port, host: "127.0.0.1" });
  console.log(`Learn While Building server running on http://127.0.0.1:${port}`);
  return app;
}
