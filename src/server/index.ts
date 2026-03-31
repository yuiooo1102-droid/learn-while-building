// src/server/index.ts
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import type { HookEvent, WatchMessage, TeachingContent, ClientMessage, Exercise, ExerciseFeedback, ConceptLevel } from "../types.js";
import { parseHookEvent, createDebouncer } from "./hook-handler.js";
import { hasTemplate, getTemplate } from "../teaching/templates.js";
import { buildPrompt } from "../teaching/generator.js";
import { loadKnowledge, saveKnowledge, updateConcept } from "../teaching/knowledge.js";
import { loadConfig, saveConfig } from "../teaching/config.js";
import { loadConceptMap, saveConceptMap, insertConcept } from "../teaching/concept-map.js";
import { buildSkillTree } from "../teaching/skill-tree.js";
import { GOAL_PRESETS } from "../teaching/goals.js";
import { appendArchive } from "../teaching/archive.js";
import { createSession, addStep, getRecentSteps } from "../teaching/session.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LWB_DIR = join(homedir(), ".learn-while-building");
const KNOWLEDGE_PATH = join(LWB_DIR, "knowledge.json");
const CONFIG_PATH = join(LWB_DIR, "config.json");
const ARCHIVE_PATH = join(LWB_DIR, "archive.jsonl");
const CONCEPT_MAP_PATH = join(LWB_DIR, "concept-map.json");
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
  let codeEventCount = 0;
  const recentEvents: HookEvent[] = [];
  let conceptMap = await loadConceptMap(CONCEPT_MAP_PATH);
  let pendingExercise: Exercise | null = null;

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
    const prompt = buildPrompt(event, knowledge, recentSteps, config.depth, config.lang, config.goal, config.projectType);

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
    codeEventCount++;

    // Sampling: only teach every N code events (save tokens)
    const TEACH_INTERVAL = 3;
    if (codeEventCount % TEACH_INTERVAL !== 1) {
      // Still record in session for context, but skip teaching
      session = addStep(session, {
        toolName: event.tool_name,
        summary: `${event.tool_name}: ${String(toolInput.file_path ?? toolInput.command ?? "").split("/").pop()}`,
        timestamp: event.timestamp ?? new Date().toISOString(),
      });
      return null;
    }

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

      // Save concept mappings from teaching content
      for (const concept of content.concepts) {
        if (concept.domain && concept.category) {
          const updated = insertConcept(conceptMap, concept.name, concept.domain, concept.category);
          if (updated !== conceptMap) {
            conceptMap = updated;
            saveConceptMap(CONCEPT_MAP_PATH, conceptMap).catch(() => {});
          }
        }
      }

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

  // Receive exercise from Claude Code
  app.post("/exercise", async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const exercise: Exercise = {
        type: "exercise",
        question: String(body.question ?? ""),
        options: Array.isArray(body.options) ? body.options.map(String) : undefined,
        hint: typeof body.hint === "string" ? body.hint : undefined,
      };
      pendingExercise = exercise;
      broadcast(exercise);
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
    if (typeof body.goal === "string") {
      config = { ...config, goal: body.goal };
    }
    if (typeof body.projectType === "string") {
      config = { ...config, projectType: body.projectType };
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

  // Skill tree
  app.post("/tree", async (_request, reply) => {
    const tree = buildSkillTree(conceptMap, knowledge);
    broadcast({ type: "skill_tree", tree });
    return reply.status(200).send();
  });

  // Goals
  app.get("/goals", async () => GOAL_PRESETS);

  app.post("/goal", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (typeof body.goal === "string") {
      config = { ...config, goal: body.goal };
      await saveConfig(CONFIG_PATH, config);
    }
    return reply.status(200).send(config);
  });

  app.post("/path", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (typeof body.projectType === "string") {
      config = { ...config, projectType: body.projectType };
      await saveConfig(CONFIG_PATH, config);
    }
    return reply.status(200).send(config);
  });

  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: "status", message: "Connected to teaching server" }));

    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as ClientMessage;
        if (msg.type === "answer" && pendingExercise) {
          const answer = msg.answer;
          const exercise = pendingExercise;
          pendingExercise = null;
          // Simple local evaluation for multiple-choice
          if (exercise.options && exercise.options.length > 0) {
            const normalized = answer.trim().toUpperCase();
            // Accept letter (A/B/C) or full text match
            const selectedIndex = normalized.length === 1 ? normalized.charCodeAt(0) - 65 : -1;
            const matchedOption = selectedIndex >= 0 && selectedIndex < exercise.options.length;
            if (matchedOption) {
              const feedback: ExerciseFeedback = {
                type: "feedback",
                correct: true,
                explanation: `You selected: ${exercise.options[selectedIndex]}. Answer recorded — keep learning!`,
                conceptUpdates: [],
              };
              broadcast(feedback);
            } else {
              const feedback: ExerciseFeedback = {
                type: "feedback",
                correct: false,
                explanation: `Your answer "${answer}" didn't match any option. Try answering with A, B, or C.`,
                conceptUpdates: [],
              };
              broadcast(feedback);
            }
          } else {
            // Open-ended: accept any non-empty answer as engagement
            const feedback: ExerciseFeedback = {
              type: "feedback",
              correct: answer.trim().length > 10,
              explanation: answer.trim().length > 10
                ? "Great effort! Your explanation shows engagement with the concept."
                : "Try to explain in more detail — a good answer is usually more than a few words.",
              conceptUpdates: [],
            };
            broadcast(feedback);
          }
        } else if (msg.type === "answer") {
          broadcast({ type: "status", message: "No active exercise — wait for the next one!" });
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

  // Session deactivation — stop teaching without removing hooks
  app.post("/session/deactivate", async (_request, reply) => {
    activeSessionId = null;
    broadcast({ type: "status", message: "Teaching mode paused" });
    return reply.status(200).send({ activeSessionId: null });
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

  // ═══ Browser Dashboard ═══
  app.get("/", async (_request, reply) => {
    const searchPaths = [
      // Plugin mode: LWB_PLUGIN_ROOT/dist/src/web/dashboard.html
      process.env.LWB_PLUGIN_ROOT ? join(process.env.LWB_PLUGIN_ROOT, "dist", "src", "web", "dashboard.html") : "",
      // Compiled mode: relative to this file
      join(dirname(fileURLToPath(import.meta.url)), "..", "web", "dashboard.html"),
      // Dev mode: from cwd
      join(process.cwd(), "src", "web", "dashboard.html"),
    ].filter(Boolean);

    for (const htmlPath of searchPaths) {
      try {
        const html = await readFile(htmlPath, "utf-8");
        return reply.type("text/html").send(html);
      } catch { continue; }
    }
    return reply.status(404).send("Dashboard not found");
  });

  // API: skill tree data
  app.get("/api/tree", async () => ({
    tree: buildSkillTree(conceptMap, knowledge),
  }));

  // API: archive entries with optional concept filter
  app.get("/api/archive", async (request) => {
    const url = new URL(request.url, `http://${request.hostname}`);
    const concept = url.searchParams.get("concept");
    const { loadArchive, filterByConcept } = await import("../teaching/archive.js");
    const entries = await loadArchive(ARCHIVE_PATH);
    return {
      entries: concept ? filterByConcept(entries, concept) : entries,
    };
  });

  // API: knowledge data
  app.get("/api/knowledge", async () => knowledge);

  // API: classify unmapped concepts with keyword-based defaults
  app.post("/api/classify", async (_request, reply) => {
    const KEYWORD_MAP: Record<string, { domain: string; category: string }> = {
      variable: { domain: "Programming Basics", category: "Variables" },
      const: { domain: "Programming Basics", category: "Variables" },
      let: { domain: "Programming Basics", category: "Variables" },
      function: { domain: "Programming Basics", category: "Functions" },
      arrow: { domain: "Programming Basics", category: "Functions" },
      param: { domain: "Programming Basics", category: "Functions" },
      loop: { domain: "Programming Basics", category: "Control Flow" },
      condition: { domain: "Programming Basics", category: "Control Flow" },
      if: { domain: "Programming Basics", category: "Control Flow" },
      switch: { domain: "Programming Basics", category: "Control Flow" },
      import: { domain: "Programming Basics", category: "Modules" },
      export: { domain: "Programming Basics", category: "Modules" },
      module: { domain: "Programming Basics", category: "Modules" },
      type: { domain: "Programming Basics", category: "Type System" },
      interface: { domain: "Programming Basics", category: "Type System" },
      generic: { domain: "Programming Basics", category: "Type System" },
      class: { domain: "Programming Basics", category: "OOP" },
      object: { domain: "Programming Basics", category: "Data Structures" },
      array: { domain: "Programming Basics", category: "Data Structures" },
      map: { domain: "Programming Basics", category: "Data Structures" },
      set: { domain: "Programming Basics", category: "Data Structures" },
      string: { domain: "Programming Basics", category: "Data Types" },
      number: { domain: "Programming Basics", category: "Data Types" },
      json: { domain: "Programming Basics", category: "Data Types" },
      async: { domain: "Programming Basics", category: "Async" },
      await: { domain: "Programming Basics", category: "Async" },
      promise: { domain: "Programming Basics", category: "Async" },
      callback: { domain: "Programming Basics", category: "Async" },
      error: { domain: "Programming Basics", category: "Error Handling" },
      try: { domain: "Programming Basics", category: "Error Handling" },
      catch: { domain: "Programming Basics", category: "Error Handling" },
      throw: { domain: "Programming Basics", category: "Error Handling" },
      http: { domain: "Web Development", category: "HTTP" },
      request: { domain: "Web Development", category: "HTTP" },
      response: { domain: "Web Development", category: "HTTP" },
      api: { domain: "Web Development", category: "API" },
      rest: { domain: "Web Development", category: "API" },
      endpoint: { domain: "Web Development", category: "API" },
      route: { domain: "Web Development", category: "API" },
      html: { domain: "Web Development", category: "Frontend" },
      css: { domain: "Web Development", category: "Frontend" },
      dom: { domain: "Web Development", category: "Frontend" },
      react: { domain: "Web Development", category: "Frontend" },
      component: { domain: "Web Development", category: "Frontend" },
      database: { domain: "Web Development", category: "Database" },
      query: { domain: "Web Development", category: "Database" },
      sql: { domain: "Web Development", category: "Database" },
      git: { domain: "DevOps", category: "Version Control" },
      commit: { domain: "DevOps", category: "Version Control" },
      branch: { domain: "DevOps", category: "Version Control" },
      push: { domain: "DevOps", category: "Version Control" },
      npm: { domain: "DevOps", category: "Package Management" },
      package: { domain: "DevOps", category: "Package Management" },
      test: { domain: "Testing", category: "Testing" },
      assert: { domain: "Testing", category: "Testing" },
      mock: { domain: "Testing", category: "Testing" },
      terminal: { domain: "Tools", category: "Terminal" },
      command: { domain: "Tools", category: "Terminal" },
      pipe: { domain: "Tools", category: "Terminal" },
      file: { domain: "Tools", category: "File System" },
      path: { domain: "Tools", category: "File System" },
      read: { domain: "Tools", category: "File System" },
      write: { domain: "Tools", category: "File System" },
      regex: { domain: "Tools", category: "Text Processing" },
      pattern: { domain: "Tools", category: "Text Processing" },
      debug: { domain: "Debugging", category: "Debugging" },
      log: { domain: "Debugging", category: "Debugging" },
      websocket: { domain: "Web Development", category: "Real-time" },
      socket: { domain: "Web Development", category: "Real-time" },
      event: { domain: "Programming Basics", category: "Events" },
      listener: { domain: "Programming Basics", category: "Events" },
      observer: { domain: "Design Patterns", category: "Patterns" },
      factory: { domain: "Design Patterns", category: "Patterns" },
      singleton: { domain: "Design Patterns", category: "Patterns" },
      decorator: { domain: "Design Patterns", category: "Patterns" },
    };

    let classified = 0;
    for (const conceptName of Object.keys(knowledge.concepts)) {
      if (conceptMap.concepts[conceptName]) continue;
      const lower = conceptName.toLowerCase().replace(/_/g, " ");
      let matched = false;
      for (const [keyword, mapping] of Object.entries(KEYWORD_MAP)) {
        if (lower.includes(keyword)) {
          conceptMap = insertConcept(conceptMap, conceptName, mapping.domain, mapping.category);
          classified++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        conceptMap = insertConcept(conceptMap, conceptName, "Other", "Uncategorized");
        classified++;
      }
    }
    if (classified > 0) {
      await saveConceptMap(CONCEPT_MAP_PATH, conceptMap);
    }
    return reply.status(200).send({ classified });
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

// Auto-start when run directly (plugin hook spawns this file)
const isDirectRun = process.argv[1]?.endsWith("server/index.js") || process.argv[1]?.endsWith("server/index.ts");
if (isDirectRun) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
