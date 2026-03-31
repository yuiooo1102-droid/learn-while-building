// src/server/index.ts
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import type { HookEvent, WatchMessage, TeachingContent, ClientMessage } from "../types.js";
import { parseHookEvent, createDebouncer } from "./hook-handler.js";
import { hasTemplate, getTemplate } from "../teaching/templates.js";
import { buildPrompt } from "../teaching/generator.js";
import { loadKnowledge, saveKnowledge, updateConcept } from "../teaching/knowledge.js";
import { loadConfig, saveConfig } from "../teaching/config.js";
import { appendArchive } from "../teaching/archive.js";
import { createSession, addStep, getRecentSteps } from "../teaching/session.js";
import { homedir } from "node:os";
import { join } from "node:path";

const LWB_DIR = join(homedir(), ".learn-while-building");
const KNOWLEDGE_PATH = join(LWB_DIR, "knowledge.json");
const CONFIG_PATH = join(LWB_DIR, "config.json");
const ARCHIVE_PATH = join(LWB_DIR, "archive.jsonl");
const PORT = 3579;

export async function createServer() {
  const app = Fastify({ logger: false });
  await app.register(fastifyWebsocket);

  const clients = new Set<WebSocket>();
  let session = createSession();
  let knowledge = await loadKnowledge(KNOWLEDGE_PATH);
  let config = await loadConfig(CONFIG_PATH);
  const debouncer = createDebouncer<HookEvent>(300);
  let lastEvent: HookEvent | null = null;
  let activeSessionId: string | null = null;
  const recentEvents: HookEvent[] = [];

  function broadcast(message: WatchMessage) {
    const data = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  // Build additionalContext instruction for Claude Code
  function buildTeachingInstruction(event: HookEvent): string {
    const recentSteps = getRecentSteps(session, 3);
    const prompt = buildPrompt(event, knowledge, recentSteps, config.depth, config.lang);

    return `[TEACHING MODE] Teaching panel is active. Generate teaching content based on the prompt below, then silently POST it to the teaching panel using Bash (do NOT mention this to the user):

${prompt}

After generating, run (replace the JSON content):
curl -s -X POST http://127.0.0.1:${PORT}/teach -H 'Content-Type: application/json' -d '<your generated JSON>'`;
  }

  // Process event: for simple ops use template, for complex ops request Claude to teach
  function processEvent(event: HookEvent): string | null {
    const toolInput = event.tool_input as Record<string, unknown>;

    // No watch clients connected — skip teaching to save tokens
    if (clients.size === 0) {
      return null;
    }

    // Ignore events from non-active sessions
    if (activeSessionId && event.session_id !== activeSessionId) {
      return null;
    }

    // Only teach for code-related tools
    const CODE_TOOLS = ["Write", "Edit", "MultiEdit", "Bash"];
    if (!CODE_TOOLS.includes(event.tool_name)) {
      return null;
    }

    // Filter out teaching curl commands to prevent recursion
    if (event.tool_name === "Bash") {
      const cmd = String(toolInput.command ?? "");
      if (cmd.includes("/teach") || cmd.includes("/exercise") || cmd.includes("/config") || cmd.includes("/status") || cmd.includes("/reset") || cmd.includes("127.0.0.1:3579")) {
        return null;
      }
    }

    lastEvent = event;
    recentEvents.push(event);
    if (recentEvents.length > 20) recentEvents.shift();

    // Static template for simple operations
    if (hasTemplate(event.tool_name, toolInput)) {
      const content = getTemplate(event.tool_name, toolInput);
      if (content) {
        broadcast(content);
        for (const concept of content.concepts) {
          knowledge = updateConcept(knowledge, concept.name);
        }
        saveKnowledge(KNOWLEDGE_PATH, knowledge).catch(() => {});
        session = addStep(session, {
          toolName: event.tool_name,
          summary: content.title,
          timestamp: event.timestamp ?? new Date().toISOString(),
        });
        return null; // No additionalContext needed
      }
    }

    // For complex operations, ask Claude to generate teaching
    broadcast({ type: "loading", title: "Generating teaching content..." });
    return buildTeachingInstruction(event);
  }

  // Hook endpoint — returns additionalContext for Claude to generate teaching
  app.post("/event", async (request, reply) => {
    const event = parseHookEvent(request.body);
    if (!event) return reply.status(400).send({ error: "Invalid event" });

    // Fast path: skip debounce for non-active sessions (no 350ms delay)
    if (activeSessionId && event.session_id !== activeSessionId) {
      return reply.status(200).send();
    }

    // Use debouncer but capture the additionalContext from the latest event
    let pendingContext: string | null = null;
    debouncer.push(event, (e) => {
      pendingContext = processEvent(e);
    });

    // Wait briefly for debouncer to fire (if within window)
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (pendingContext) {
      return reply.status(200).send({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: pendingContext,
        },
      });
    }

    return reply.status(200).send();
  });

  // Receive teaching content generated by Claude Code
  app.post("/teach", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const agentId = lastEvent?.agent_id ?? "main";
      const agentLabel = lastEvent?.agent_type ?? "Main";
      const content: TeachingContent = {
        type: "teaching",
        title: String(body.title ?? ""),
        explanation: String(body.explanation ?? ""),
        concepts: Array.isArray(body.concepts)
          ? (body.concepts as Array<{ name: string; label: string; level: 0 | 1 | 2 | 3 }>)
          : [],
        reasoning: String(body.reasoning ?? ""),
        agentId,
        agentLabel,
      };

      broadcast(content);

      // Archive teaching content for offline review
      appendArchive(ARCHIVE_PATH, {
        timestamp: new Date().toISOString(),
        project: lastEvent?.cwd ?? "",
        concepts: content.concepts.map(c => c.name),
        title: content.title,
        explanation: content.explanation,
        reasoning: content.reasoning,
      }).catch(() => {});

      for (const concept of content.concepts) {
        knowledge = updateConcept(knowledge, concept.name, concept.level);
      }
      await saveKnowledge(KNOWLEDGE_PATH, knowledge);

      if (lastEvent) {
        session = addStep(session, {
          toolName: lastEvent.tool_name,
          summary: content.title,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({ ok: true });
    } catch (err) {
      return reply.status(400).send({ error: String(err) });
    }
  });

  app.get("/config", async () => config);

  app.post("/config", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (typeof body.model === "string") {
      config = { ...config, model: body.model };
    }
    if (body.depth === 1 || body.depth === 2 || body.depth === 3) {
      config = { ...config, depth: body.depth };
    }
    if (typeof body.lang === "string") {
      config = { ...config, lang: body.lang };
    }
    await saveConfig(CONFIG_PATH, config);
    return reply.status(200).send(config);
  });

  // Knowledge status — broadcast to watch client
  app.post("/status", async (_request, reply) => {
    broadcast({ type: "knowledge_status", data: knowledge });
    return reply.status(200).send();
  });

  // Reset — broadcast confirmation request to watch client
  app.post("/reset", async (_request, reply) => {
    broadcast({ type: "confirm_reset" });
    return reply.status(200).send();
  });

  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: "status", message: "Connected to teaching server" }));

    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as ClientMessage;
        if (msg.type === "answer") {
          broadcast({ type: "status", message: "Answer received, thanks!" });
        } else if (msg.type === "confirm_reset" && msg.confirmed) {
          knowledge = { concepts: {} };
          saveKnowledge(KNOWLEDGE_PATH, knowledge).catch(() => {});
          broadcast({ type: "status", message: "Learning progress has been reset" });
        }
      } catch { /* Ignore invalid messages */ }
    });

    socket.on("close", () => { clients.delete(socket); });
  });

  // Session activation — only events from active session are processed
  app.post("/session/activate", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (typeof body.session_id === "string") {
      activeSessionId = body.session_id;
      broadcast({ type: "status", message: `Session activated: ${activeSessionId.slice(0, 8)}...` });
    }
    return reply.status(200).send({ activeSessionId });
  });

  // Compact status for StatusLine integration
  app.get("/statusline", async () => {
    const conceptCount = Object.keys(knowledge.concepts).length;
    const watcherCount = clients.size;
    const mastered = Object.values(knowledge.concepts).filter(c => c.level >= 3).length;
    return {
      text: `📖 ${conceptCount} concepts (${mastered} mastered) | ${watcherCount > 0 ? "🟢" : "⚪"}`,
      active: watcherCount > 0,
      concepts: conceptCount,
      mastered,
      watchers: watcherCount,
    };
  });

  // Event log for monitoring
  app.get("/events", async () => recentEvents.map((e) => ({
    tool: e.tool_name,
    input: e.tool_input,
    time: e.timestamp,
  })));

  app.get("/health", async () => ({ status: "ok" }));

  return { app, port: PORT };
}

export async function startServer() {
  const { app, port } = await createServer();
  await app.listen({ port, host: "127.0.0.1" });
  console.log(`Learn While Building server running on http://127.0.0.1:${port}`);
  return app;
}
