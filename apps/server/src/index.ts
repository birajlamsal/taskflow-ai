import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";
import {
  chatCommandSchema,
  type ChatCommand,
  type Task,
  type TaskList,
  type User
} from "@taskflow/shared";

const app = Fastify({ logger: false });

await app.register(cors, {
  origin: true,
  credentials: true
});

await app.register(rateLimit, {
  max: 120,
  timeWindow: "1 minute"
});

const PORT = Number(process.env.PORT ?? 4000);

const TOKEN_KEY = process.env.TOKEN_ENCRYPTION_KEY ?? "dev_insecure_key";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev_session_secret";
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? "";
const SUPABASE_JWT_PUBLIC_KEY = process.env.SUPABASE_JWT_PUBLIC_KEY ?? "";
const SUPABASE_JWKS_PATH =
  process.env.SUPABASE_JWKS_PATH ?? path.join(process.cwd(), "jwks.json");

function getSupabaseVerifyKey() {
  if (SUPABASE_JWT_PUBLIC_KEY) {
    return { key: SUPABASE_JWT_PUBLIC_KEY, alg: "RS256" as const };
  }
  if (fs.existsSync(SUPABASE_JWKS_PATH)) {
    const raw = fs.readFileSync(SUPABASE_JWKS_PATH, "utf8");
    const jwks = JSON.parse(raw) as { keys?: Array<Record<string, any>> };
    const jwk = jwks.keys?.[0];
    if (jwk) {
      return {
        key: jwkToPem(jwk),
        alg: (jwk.alg ?? "RS256") as "RS256" | "ES256"
      };
    }
  }
  if (SUPABASE_JWT_SECRET) {
    return { key: SUPABASE_JWT_SECRET, alg: "HS256" as const };
  }
  return null;
}
const USE_MOCK_AUTH = process.env.USE_MOCK_AUTH === "true" || !SUPABASE_JWT_SECRET;

const users = new Map<string, User>();
const sessions = new Map<string, string>();
const taskLists = new Map<string, TaskList[]>();
const tasks = new Map<string, Task[]>();
const oauthStates = new Map<
  string,
  { userId: string; codeVerifier: string; createdAt: number }
>();
const userTokens = new Map<
  string,
  { access_token: string; refresh_token?: string; expires_in?: number }
>();

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(TOKEN_KEY).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

function decrypt(value: string) {
  const [ivHex, tagHex, dataHex] = value.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const key = crypto.createHash("sha256").update(TOKEN_KEY).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function signSession(userId: string) {
  const payload = `${userId}:${Date.now()}`;
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  const token = Buffer.from(`${payload}:${sig}`).toString("base64url");
  sessions.set(token, userId);
  return token;
}

function getAuthInfo(req: { headers: Record<string, string | undefined> }) {
  const auth = req.headers.authorization ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;

  if (!SUPABASE_JWT_SECRET && USE_MOCK_AUTH) {
    const userId = sessions.get(token);
    if (!userId) return null;
    return users.get(userId) ?? null;
  }

  const verifyKey = getSupabaseVerifyKey();
  if (!verifyKey) return null;
  try {
    const payload = jwt.verify(token, verifyKey.key, {
      algorithms: [verifyKey.alg]
    }) as {
      sub?: string;
      email?: string;
      user_metadata?: { name?: string; full_name?: string; avatar_url?: string };
    };
    if (!payload?.sub || !payload?.email) return null;
    const existing = users.get(payload.sub);
    if (existing) return existing;
    const user: User = {
      id: payload.sub,
      email: payload.email,
      name: payload.user_metadata?.full_name ?? payload.user_metadata?.name,
      picture: payload.user_metadata?.avatar_url
    };
    users.set(user.id, user);
    ensureSeed(user.id);
    return user;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "JWT verify failed" } as any;
  }
}

function requireAuth(req: { headers: Record<string, string | undefined> }) {
  const info = getAuthInfo(req) as any;
  if (!info || info.error) return null;
  return info as User;
}

function ensureSeed(userId: string) {
  if (!taskLists.has(userId)) {
    taskLists.set(userId, [
      { id: "inbox", title: "Inbox", updatedAt: new Date().toISOString() }
    ]);
  }
  if (!tasks.has(userId)) {
    tasks.set(userId, []);
  }
}

app.get("/health", async () => ({ status: "ok" }));

app.get("/status", async () => {
  return {
    server: "ok",
    db: {
      configured: Boolean(process.env.DATABASE_URL)
    },
    google: {
      clientIdConfigured: Boolean(process.env.GOOGLE_CLIENT_ID)
    },
    auth: {
      supabaseConfigured: Boolean(process.env.SUPABASE_JWT_SECRET)
    }
  };
});

app.post("/auth/google/start", async (req, reply) => {
  const authInfo = getAuthInfo(req) as any;
  if (!authInfo || authInfo.error) {
    return reply
      .status(401)
      .send({ error: authInfo?.error ? `Unauthorized: ${authInfo.error}` : "Unauthorized" });
  }
  const user = authInfo as User;
  if (USE_MOCK_AUTH) {
    return { authUrl: "mock://auth?state=demo" };
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return {
      error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI."
    };
  }
  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = Buffer.from(hash).toString("base64url");
  oauthStates.set(state, { userId: user.id, codeVerifier, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/tasks",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });
  return { authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
});

app.post("/auth/google/callback", async (req) => {
  if (USE_MOCK_AUTH) {
    const user: User = {
      id: "demo-user",
      email: "demo@taskflow.local",
      name: "Demo User"
    };
    users.set(user.id, user);
    ensureSeed(user.id);
    const token = signSession(user.id);
    return { token, user };
  }

  const body = req.body as { code?: string };
  if (!body?.code) {
    return { error: "Missing code" };
  }

  const encrypted = encrypt(body.code);
  void decrypt(encrypted);
  return { error: "OAuth exchange not configured" };
});

app.get("/auth/google/callback", async (req, reply) => {
  const query = req.query as { code?: string; state?: string };
  if (!query?.code || !query?.state) {
    return reply.status(400).send({ error: "Missing code or state" });
  }
  const record = oauthStates.get(query.state);
  if (!record) {
    return reply.status(400).send({ error: "Invalid or expired state" });
  }
  oauthStates.delete(query.state);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return reply.status(500).send({ error: "Google OAuth not configured" });
  }

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    code: query.code,
    code_verifier: record.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  });
  if (clientSecret) tokenParams.set("client_secret", clientSecret);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams
  });
  if (!tokenRes.ok) {
    return reply.status(400).send({ error: "Token exchange failed" });
  }
  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  userTokens.set(record.userId, tokenData);
  const webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:3000";
  return reply.redirect(`${webAppUrl}/settings?google=connected`);
});

app.get("/me", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  return user;
});

app.get("/tasklists", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  ensureSeed(user.id);
  return taskLists.get(user.id) ?? [];
});

app.get("/tasklists/:id/tasks", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  ensureSeed(user.id);
  const listId = (req.params as { id: string }).id;
  const items = (tasks.get(user.id) ?? []).filter((t) => t.listId === listId);
  return items;
});

app.post("/tasks", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  ensureSeed(user.id);
  const body = req.body as Partial<Task> & { listId?: string };
  if (!body?.title || !body.listId) {
    return reply.status(400).send({ error: "Missing title or listId" });
  }
  const now = new Date().toISOString();
  const task: Task = {
    id: crypto.randomUUID(),
    listId: body.listId,
    title: body.title,
    notes: body.notes,
    due: body.due,
    completed: false,
    createdAt: now,
    updatedAt: now
  };
  tasks.set(user.id, [...(tasks.get(user.id) ?? []), task]);
  return task;
});

app.patch("/tasks/:id", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  ensureSeed(user.id);
  const id = (req.params as { id: string }).id;
  const updates = req.body as Partial<Task>;
  const list = tasks.get(user.id) ?? [];
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return reply.status(404).send({ error: "Not found" });
  const updated = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
  list[idx] = updated;
  tasks.set(user.id, list);
  return updated;
});

app.delete("/tasks/:id", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  ensureSeed(user.id);
  const id = (req.params as { id: string }).id;
  tasks.set(
    user.id,
    (tasks.get(user.id) ?? []).filter((t) => t.id !== id)
  );
  return { ok: true };
});

async function callOpenAI(prompt: string): Promise<ChatCommand> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a command parser for TaskFlow. Return ONLY strict JSON that matches the ChatCommand schema."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }
  const data = (await response.json()) as any;
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  return chatCommandSchema.parse(parsed);
}

function naiveParse(text: string): ChatCommand {
  const lower = text.toLowerCase();
  if (lower.startsWith("add ") || lower.includes("add task")) {
    return { action: "add_task", title: text.replace(/^add\s+/i, "").trim() };
  }
  if (lower.includes("complete")) {
    return { action: "complete_task", query: text };
  }
  if (lower.includes("delete")) {
    return { action: "delete_task", query: text };
  }
  if (lower.includes("today")) {
    return { action: "list_today" };
  }
  if (lower.includes("free")) {
    return { action: "check_availability_now", minutes: 45 };
  }
  return { action: "search_tasks", query: text };
}

app.post("/ai/command", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  ensureSeed(user.id);
  const body = req.body as { text?: string };
  if (!body?.text) return reply.status(400).send({ error: "Missing text" });

  let command: ChatCommand;
  try {
    command = await callOpenAI(body.text);
  } catch {
    command = naiveParse(body.text);
  }

  const list = tasks.get(user.id) ?? [];
  let message = "";

  if (command.action === "add_task") {
    const listId = command.listId ?? "inbox";
    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      listId,
      title: command.title ?? "Untitled",
      notes: command.notes,
      due: command.due,
      completed: false,
      createdAt: now,
      updatedAt: now
    };
    tasks.set(user.id, [...list, task]);
    message = `Added task: ${task.title}`;
  } else if (command.action === "complete_task") {
    if (!command.taskId) {
      return reply.status(400).send({ error: "taskId required" });
    }
    const idx = list.findIndex((t) => t.id === command.taskId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], completed: true, updatedAt: new Date().toISOString() };
      tasks.set(user.id, list);
      message = `Completed task: ${list[idx].title}`;
    }
  } else if (command.action === "delete_task") {
    if (!command.taskId) {
      return reply.status(400).send({ error: "taskId required" });
    }
    tasks.set(
      user.id,
      list.filter((t) => t.id !== command.taskId)
    );
    message = "Deleted task";
  } else if (command.action === "list_today") {
    message = "Listing tasks due today";
  } else if (command.action === "search_tasks") {
    message = "Search results";
  } else if (command.action === "check_availability_now") {
    message = "Calendar not connected. Enable Google Calendar to check availability.";
  } else {
    message = "Command received";
  }

  return {
    command,
    message,
    tasks: tasks.get(user.id) ?? []
  };
});

app.get("/availability/now", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const minutes = Number((req.query as { minutes?: string }).minutes ?? 45);
  return {
    minutes,
    available: true,
    message: "Calendar not connected. Assuming available."
  };
});

app.get("/google/status", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const tokens = userTokens.get(user.id);
  return {
    connected: Boolean(tokens?.refresh_token || tokens?.access_token)
  };
});

app.get("/auth/debug", async (req, reply) => {
  const auth = req.headers.authorization ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return reply.status(401).send({ error: "Missing bearer token" });
  if (!SUPABASE_JWT_SECRET && USE_MOCK_AUTH) {
    const userId = sessions.get(token);
    return reply.send({ mode: "mock", userId, ok: Boolean(userId) });
  }
  const verifyKey = getSupabaseVerifyKey();
  if (!verifyKey) {
    return reply
      .status(400)
      .send({
        error:
          "SUPABASE_JWT_SECRET or SUPABASE_JWT_PUBLIC_KEY or SUPABASE_JWKS_PATH not set"
      });
  }
  try {
    const payload = jwt.verify(token, verifyKey.key, {
      algorithms: [verifyKey.alg]
    });
    return reply.send({ ok: true, payload });
  } catch (err) {
    return reply.status(401).send({
      ok: false,
      error: err instanceof Error ? err.message : "JWT verify failed"
    });
  }
});

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`Server running on http://localhost:${PORT}`);
});
