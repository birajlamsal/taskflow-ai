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
import { Pool } from "pg";
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
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const dbPool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;
const userTokens = new Map<
  string,
  {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
  }
>();
const userAiKeys = new Map<string, Map<string, string>>();
const pendingAdds = new Map<
  string,
  {
    title: string;
    due?: string;
    notes?: string;
    createdAt: number;
    stage: "need_due" | "need_notes" | "need_list";
  }
>();
const lastSearchResults = new Map<string, string[]>();
const pendingGeneral = new Map<
  string,
  { kind: "weather"; question: string; createdAt: number }
>();
const aiTools = [
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "google", name: "Google Gemini" },
  { id: "mistral", name: "Mistral" },
  { id: "cohere", name: "Cohere" }
];

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

async function getOAuthTokensFromDb(userId: string) {
  if (!dbPool) return null;
  const res = await dbPool.query<{
    refresh_token_encrypted: string;
    access_token_encrypted: string | null;
    scope: string | null;
    expires_at: string | null;
  }>(
    `select refresh_token_encrypted, access_token_encrypted, scope, expires_at
     from public.oauth_accounts
     where user_id = $1 and provider = 'google'
     limit 1`,
    [userId]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    refresh_token: row.refresh_token_encrypted
      ? decrypt(row.refresh_token_encrypted)
      : undefined,
    access_token: row.access_token_encrypted ? decrypt(row.access_token_encrypted) : undefined,
    scope: row.scope ?? undefined,
    expires_at: row.expires_at ? new Date(row.expires_at).getTime() : undefined
  };
}

async function saveOAuthTokensToDb(params: {
  userId: string;
  accessToken?: string;
  refreshToken?: string;
  scope?: string;
  expiresAt?: number;
}) {
  if (!dbPool) return;
  const { userId, accessToken, refreshToken, scope, expiresAt } = params;
  if (refreshToken) {
    await dbPool.query(
      `insert into public.oauth_accounts
       (user_id, provider, refresh_token_encrypted, access_token_encrypted, scope, expires_at)
       values ($1, 'google', $2, $3, $4, $5)
       on conflict (user_id, provider)
       do update set
         refresh_token_encrypted = excluded.refresh_token_encrypted,
         access_token_encrypted = excluded.access_token_encrypted,
         scope = excluded.scope,
         expires_at = excluded.expires_at,
         updated_at = now()`,
      [
        userId,
        encrypt(refreshToken),
        accessToken ? encrypt(accessToken) : null,
        scope ?? null,
        expiresAt ? new Date(expiresAt).toISOString() : null
      ]
    );
  } else if (accessToken) {
    await dbPool.query(
      `update public.oauth_accounts
       set access_token_encrypted = $2,
           scope = $3,
           expires_at = $4,
           updated_at = now()
       where user_id = $1 and provider = 'google'`,
      [
        userId,
        encrypt(accessToken),
        scope ?? null,
        expiresAt ? new Date(expiresAt).toISOString() : null
      ]
    );
  }
}

async function getGoogleLists(userId: string) {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) return [];
  const res = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Google Tasks API error: ${res.status}`);
  }
  const data = (await res.json()) as {
    items?: Array<{ id: string; title: string; updated?: string }>;
  };
  return (data.items ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    updatedAt: item.updated
  }));
}

async function getGoogleTasksForUser(userId: string) {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) return [];
  const lists = await getGoogleLists(userId);
  const results = await Promise.all(
    lists.map(async (list) => {
      const res = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=true&showHidden=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return [];
      const data = (await res.json()) as {
        items?: Array<{
          id: string;
          title: string;
          notes?: string;
          due?: string;
          status?: string;
          updated?: string;
        }>;
      };
      return (data.items ?? []).map((item) => ({
        id: item.id,
        listId: list.id,
        title: item.title,
        notes: item.notes,
        due: item.due,
        completed: item.status === "completed",
        updatedAt: item.updated
      })) as Task[];
    })
  );
  return results.flat();
}

async function getTasksForAi(userId: string) {
  try {
    const accessToken = await getGoogleAccessToken(userId);
    if (accessToken) {
      return await getGoogleTasksForUser(userId);
    }
  } catch {
    // fall back to local cache
  }
  return tasks.get(userId) ?? [];
}

async function getToolDbId(slug: string) {
  if (!dbPool) return null;
  const res = await dbPool.query<{ id: string }>(
    "select id from public.ai_tools where slug = $1 limit 1",
    [slug]
  );
  return res.rows[0]?.id ?? null;
}

async function saveAiKeyToDb(userId: string, toolSlug: string, apiKey: string) {
  if (!dbPool) {
    throw new Error("DATABASE_URL not set");
  }
  const toolId = await getToolDbId(toolSlug);
  if (!toolId) {
    throw new Error("Unknown tool");
  }
  const encrypted = encrypt(apiKey);
  await dbPool.query(
    `insert into public.ai_provider_keys (user_id, tool_id, api_key_encrypted)
     values ($1, $2, $3)
     on conflict (user_id, tool_id)
     do update set api_key_encrypted = excluded.api_key_encrypted, updated_at = now()`,
    [userId, toolId, encrypted]
  );
}

async function getAiKeyFromDb(userId: string, toolSlug: string) {
  if (!dbPool) return null;
  const res = await dbPool.query<{ api_key_encrypted: string }>(
    `select apk.api_key_encrypted
     from public.ai_provider_keys apk
     join public.ai_tools t on t.id = apk.tool_id
     where apk.user_id = $1 and t.slug = $2
     limit 1`,
    [userId, toolSlug]
  );
  const enc = res.rows[0]?.api_key_encrypted;
  if (!enc) return null;
  return decrypt(enc);
}

async function deleteAiKeyFromDb(userId: string, toolSlug: string) {
  if (!dbPool) return;
  const toolId = await getToolDbId(toolSlug);
  if (!toolId) {
    throw new Error("Unknown tool");
  }
  await dbPool.query(
    "delete from public.ai_provider_keys where user_id = $1 and tool_id = $2",
    [userId, toolId]
  );
}

async function getConfiguredToolSlugs(userId: string) {
  if (!dbPool) {
    const userMap = userAiKeys.get(userId);
    return userMap ? Array.from(userMap.keys()) : [];
  }
  const res = await dbPool.query<{ slug: string }>(
    `select t.slug
     from public.ai_provider_keys apk
     join public.ai_tools t on t.id = apk.tool_id
     where apk.user_id = $1`,
    [userId]
  );
  return res.rows.map((row) => row.slug);
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

async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID not configured");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  if (clientSecret) params.set("client_secret", clientSecret);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });
  if (!res.ok) {
    throw new Error("Failed to refresh access token");
  }
  return (await res.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

async function getGoogleAccessToken(userId: string) {
  let tokens = userTokens.get(userId);
  if (!tokens) {
    const dbTokens = await getOAuthTokensFromDb(userId);
    if (dbTokens?.access_token || dbTokens?.refresh_token) {
      tokens = {
        access_token: dbTokens.access_token ?? "",
        refresh_token: dbTokens.refresh_token,
        expires_at: dbTokens.expires_at
      };
      userTokens.set(userId, tokens);
    }
  }
  if (!tokens) return null;
  const now = Date.now();
  if (tokens.access_token && (!tokens.expires_at || tokens.expires_at > now + 30_000)) {
    return tokens.access_token;
  }
  if (!tokens.refresh_token) return tokens.access_token ?? null;
  const refreshed = await refreshGoogleAccessToken(tokens.refresh_token);
  userTokens.set(userId, {
    ...tokens,
    access_token: refreshed.access_token,
    expires_in: refreshed.expires_in,
    expires_at: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : undefined
  });
  await saveOAuthTokensToDb({
    userId,
    accessToken: refreshed.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: refreshed.expires_in
      ? Date.now() + refreshed.expires_in * 1000
      : undefined
  });
  return refreshed.access_token;
}

app.get("/health", async () => ({ status: "ok" }));

app.get("/status", async () => {
  return {
    server: "ok",
    db: {
      configured: Boolean(process.env.DATABASE_URL)
    },
    google: {
      clientIdConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
      redirectConfigured: Boolean(process.env.GOOGLE_REDIRECT_URI)
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
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = Buffer.from(hash).toString("base64url");
  const payload = JSON.stringify({
    u: user.id,
    cv: codeVerifier,
    ts: Date.now()
  });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payloadB64).digest("base64url");
  const state = `${payloadB64}.${sig}`;

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
  const [payloadB64, sig] = query.state.split(".");
  if (!payloadB64 || !sig) {
    return reply.status(400).send({ error: "Invalid state format" });
  }
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
  if (expected !== sig) {
    return reply.status(400).send({ error: "Invalid or expired state" });
  }
  const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
  let statePayload: { u: string; cv: string; ts: number };
  try {
    statePayload = JSON.parse(payloadJson);
  } catch {
    return reply.status(400).send({ error: "Invalid or expired state" });
  }
  if (Date.now() - statePayload.ts > OAUTH_STATE_TTL_MS) {
    return reply.status(400).send({ error: "Invalid or expired state" });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return reply.status(500).send({ error: "Google OAuth not configured" });
  }

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    code: query.code,
    code_verifier: statePayload.cv,
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

  userTokens.set(statePayload.u, {
    ...tokenData,
    expires_at: tokenData.expires_in
      ? Date.now() + tokenData.expires_in * 1000
      : undefined
  });
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
  const accessToken = await getGoogleAccessToken(user.id);
  if (!accessToken) {
    return taskLists.get(user.id) ?? [];
  }
  const res = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    return reply
      .status(502)
      .send({ error: "Google Tasks API error", status: res.status });
  }
  const data = (await res.json()) as { items?: Array<{ id: string; title: string; updated?: string }> };
  const lists = (data.items ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    updatedAt: item.updated
  }));
  return lists;
});

app.get("/tasklists/:id/tasks", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  ensureSeed(user.id);
  const listId = (req.params as { id: string }).id;
  const accessToken = await getGoogleAccessToken(user.id);
  if (!accessToken) {
    const items = (tasks.get(user.id) ?? []).filter((t) => t.listId === listId);
    return items;
  }
  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  if (!res.ok) {
    return reply
      .status(502)
      .send({ error: "Google Tasks API error", status: res.status });
  }
  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      title: string;
      notes?: string;
      due?: string;
      status?: string;
      updated?: string;
    }>;
  };
  return (data.items ?? []).map((item) => ({
    id: item.id,
    listId,
    title: item.title,
    notes: item.notes,
    due: item.due,
    completed: item.status === "completed",
    updatedAt: item.updated
  }));
});

app.post("/tasks", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  ensureSeed(user.id);
  const body = req.body as Partial<Task> & { listId?: string };
  if (!body?.title || !body.listId) {
    return reply.status(400).send({ error: "Missing title or listId" });
  }
  const accessToken = await getGoogleAccessToken(user.id);
  if (accessToken) {
    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${body.listId}/tasks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: body.title,
          notes: body.notes,
          due: body.due
        })
      }
    );
    if (res.ok) {
      const item = (await res.json()) as {
        id: string;
        title: string;
        notes?: string;
        due?: string;
        status?: string;
        updated?: string;
      };
      return {
        id: item.id,
        listId: body.listId,
        title: item.title,
        notes: item.notes,
        due: item.due,
        completed: item.status === "completed",
        updatedAt: item.updated
      };
    }
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
  const accessToken = await getGoogleAccessToken(user.id);
  if (accessToken && updates.listId) {
    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${updates.listId}/tasks/${id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: updates.title,
          notes: updates.notes,
          due: updates.due,
          status: updates.completed ? "completed" : "needsAction"
        })
      }
    );
    if (res.ok) {
      const item = (await res.json()) as {
        id: string;
        title: string;
        notes?: string;
        due?: string;
        status?: string;
        updated?: string;
      };
      return {
        id: item.id,
        listId: updates.listId ?? "",
        title: item.title,
        notes: item.notes,
        due: item.due,
        completed: item.status === "completed",
        updatedAt: item.updated
      };
    }
  }
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
  const listId = (req.query as { listId?: string }).listId;
  const accessToken = await getGoogleAccessToken(user.id);
  if (accessToken && listId) {
    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    if (res.ok) {
      return { ok: true };
    }
  }
  tasks.set(
    user.id,
    (tasks.get(user.id) ?? []).filter((t) => t.id !== id)
  );
  return { ok: true };
});

const SYSTEM_PROMPT =
  "You are a command parser for TaskFlow. Return ONLY strict JSON that matches the ChatCommand schema. " +
  "Allowed action values: add_task, update_task, reschedule_task, complete_task, delete_task, list_today, search_tasks, check_availability_now. " +
  "Return a single JSON object only, no markdown or code fences.";
const CHAT_PROMPT =
  "You are a helpful assistant. Answer conversationally and concisely.";

async function callOpenAI(prompt: string, apiKeyOverride?: string): Promise<string> {
  const apiKey = apiKeyOverride ?? process.env.OPENAI_API_KEY;
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
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }
  const data = (await response.json()) as any;
  return data?.choices?.[0]?.message?.content ?? "{}";
}

async function callOpenAIChat(prompt: string, apiKeyOverride?: string): Promise<string> {
  const apiKey = apiKeyOverride ?? process.env.OPENAI_API_KEY;
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
        { role: "system", content: CHAT_PROMPT },
        { role: "user", content: prompt }
      ],
      temperature: 0.4
    })
  });
  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }
  const data = (await response.json()) as any;
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status}`);
  }
  const data = (await response.json()) as any;
  const parts = data?.content ?? [];
  return parts.map((p: any) => p.text).join("") ?? "{}";
}

async function callAnthropicChat(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      system: CHAT_PROMPT,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status}`);
  }
  const data = (await response.json()) as any;
  const parts = data?.content ?? [];
  return parts.map((p: any) => p.text).join("") ?? "";
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\nUser: ${prompt}` }]
          }
        ]
      })
    }
  );
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const snippet = errorText ? ` - ${errorText.slice(0, 200)}` : "";
    throw new Error(`Gemini error: ${response.status}${snippet}`);
  }
  const data = (await response.json()) as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function callGeminiChat(prompt: string, apiKey: string): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${CHAT_PROMPT}\n\nUser: ${prompt}` }] }]
      })
    }
  );
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const snippet = errorText ? ` - ${errorText.slice(0, 200)}` : "";
    throw new Error(`Gemini error: ${response.status}${snippet}`);
  }
  const data = (await response.json()) as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callMistral(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL ?? "mistral-small-latest",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });
  if (!response.ok) {
    throw new Error(`Mistral error: ${response.status}`);
  }
  const data = (await response.json()) as any;
  return data?.choices?.[0]?.message?.content ?? "{}";
}

async function callMistralChat(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL ?? "mistral-small-latest",
      messages: [
        { role: "system", content: CHAT_PROMPT },
        { role: "user", content: prompt }
      ],
      temperature: 0.4
    })
  });
  if (!response.ok) {
    throw new Error(`Mistral error: ${response.status}`);
  }
  const data = (await response.json()) as any;
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callCohere(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.cohere.ai/v1/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.COHERE_MODEL ?? "command",
      message: `${SYSTEM_PROMPT}\n\nUser: ${prompt}`,
      stream: false
    })
  });
  if (!response.ok) {
    throw new Error(`Cohere error: ${response.status}`);
  }
  const data = (await response.json()) as any;
  return data?.text ?? data?.message ?? "{}";
}

async function callCohereChat(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.cohere.ai/v1/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.COHERE_MODEL ?? "command",
      message: `${CHAT_PROMPT}\n\nUser: ${prompt}`,
      stream: false
    })
  });
  if (!response.ok) {
    throw new Error(`Cohere error: ${response.status}`);
  }
  const data = (await response.json()) as any;
  return data?.text ?? data?.message ?? "";
}

async function generalChatWithTool(prompt: string, toolId: string, apiKey?: string) {
  if (!apiKey && toolId !== "openai") {
    throw new Error(`API key missing for ${toolId}`);
  }
  if (toolId === "openai") return callOpenAIChat(prompt, apiKey);
  if (toolId === "anthropic") return callAnthropicChat(prompt, apiKey!);
  if (toolId === "google") return callGeminiChat(prompt, apiKey!);
  if (toolId === "mistral") return callMistralChat(prompt, apiKey!);
  if (toolId === "cohere") return callCohereChat(prompt, apiKey!);
  throw new Error("Unknown tool");
}

async function parseCommandWithTool(prompt: string, toolId: string, apiKey?: string) {
  if (!apiKey && toolId !== "openai") {
    throw new Error(`API key missing for ${toolId}`);
  }
  let raw = "{}";
  if (toolId === "openai") raw = await callOpenAI(prompt, apiKey);
  else if (toolId === "anthropic") raw = await callAnthropic(prompt, apiKey!);
  else if (toolId === "google") raw = await callGemini(prompt, apiKey!);
  else if (toolId === "mistral") raw = await callMistral(prompt, apiKey!);
  else if (toolId === "cohere") raw = await callCohere(prompt, apiKey!);
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (parsed && typeof parsed.action === "string") {
    parsed.action = parsed.action.toLowerCase();
  }
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
  if (lower.includes("tomorrow")) {
    return { action: "search_tasks", query: "tomorrow" };
  }
  if (lower.includes("free")) {
    return { action: "check_availability_now", minutes: 45 };
  }
  return { action: "search_tasks", query: text };
}

function inferDueFromText(text: string) {
  const lower = text.toLowerCase();
  const now = new Date();
  if (lower.includes("tomorrow") || /tomor+ow|tomotow|tomm?or?ow|tmrw/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  if (lower.includes("today")) {
    return now.toISOString();
  }
  return undefined;
}

function inferTitleFromText(text: string) {
  const cleaned = text
    .replace(/please|can you|could you|add|task|to do|todo|tomorrow|today/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || text.trim();
}

function isSameDay(due: string | undefined, date: Date) {
  if (!due) return false;
  const target = new Date(due);
  const compare = new Date(date);
  target.setHours(0, 0, 0, 0);
  compare.setHours(0, 0, 0, 0);
  return target.getTime() === compare.getTime();
}

function isToday(due?: string) {
  return isSameDay(due, new Date());
}

function isTomorrow(due?: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(due, tomorrow);
}

function looksLikeTaskQuery(text: string) {
  const lower = text.toLowerCase();
  const taskKeywords = [
    "task",
    "tasks",
    "todo",
    "to do",
    "list",
    "add",
    "remove",
    "delete",
    "complete",
    "schedule",
    "tomorrow",
    "tomor",
    "tmrw",
    "today",
    "missed",
    "upcoming",
    "due",
    "to be done"
  ];
  return taskKeywords.some((k) => lower.includes(k));
}

function hasExplicitTaskIntent(text: string) {
  const lower = text.toLowerCase();
  const intentKeywords = [
    "task",
    "tasks",
    "todo",
    "to do",
    "list",
    "add",
    "remove",
    "delete",
    "complete",
    "schedule"
  ];
  return intentKeywords.some((k) => lower.includes(k));
}

function looksLikeGeneralQuery(text: string) {
  const lower = text.toLowerCase();
  const generalKeywords = [
    "hello",
    "hi",
    "hey",
    "weather",
    "temperature",
    "rain",
    "news",
    "who is",
    "what is",
    "why",
    "how",
    "joke",
    "quote",
    "define"
  ];
  return generalKeywords.some((k) => lower.includes(k));
}

function isWeatherQuestion(text: string) {
  return text.toLowerCase().includes("weather");
}

function hasLocation(text: string) {
  return /\b(in|at|of|for)\s+[a-zA-Z]/.test(text);
}

function hasTomorrow(text: string) {
  const lower = text.toLowerCase();
  return lower.includes("tomorrow") || /tomor+ow|tomotow|tomm?or?ow|tmrw/.test(lower);
}

function hasToday(text: string) {
  return text.toLowerCase().includes("today");
}

app.post("/ai/command", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  ensureSeed(user.id);
  const body = req.body as { text?: string; toolId?: string };
  if (!body?.text) return reply.status(400).send({ error: "Missing text" });

  const toolId = body.toolId ?? "openai";
  if (!aiTools.find((t) => t.id === toolId)) {
    return reply.status(400).send({ error: "Unknown tool" });
  }

  if (isWeatherQuestion(body.text) && !hasExplicitTaskIntent(body.text)) {
    if (!hasLocation(body.text)) {
      pendingGeneral.set(user.id, { kind: "weather", question: body.text, createdAt: Date.now() });
      return reply.send({ message: "Which location?" });
    }
    let userKey = userAiKeys.get(user.id)?.get(toolId);
    if (!userKey) {
      userKey = (await getAiKeyFromDb(user.id, toolId)) ?? undefined;
      if (userKey) {
        if (!userAiKeys.has(user.id)) userAiKeys.set(user.id, new Map());
        userAiKeys.get(user.id)!.set(toolId, userKey);
      }
    }
    if (toolId === "openai" && !userKey && !process.env.OPENAI_API_KEY) {
      return reply.status(400).send({ error: "API key missing for openai" });
    }
    if (toolId !== "openai" && !userKey) {
      return reply.status(400).send({ error: `API key missing for ${toolId}` });
    }
    try {
      const replyText = await generalChatWithTool(body.text, toolId, userKey);
      return reply.send({ message: replyText || "OK" });
    } catch (err) {
      return reply
        .status(502)
        .send({ error: err instanceof Error ? err.message : "AI failed" });
    }
  }

  const pendingGen = pendingGeneral.get(user.id);
  if (pendingGen) {
    pendingGeneral.delete(user.id);
    const combined = `${pendingGen.question} in ${body.text}`;
    let userKey = userAiKeys.get(user.id)?.get(toolId);
    if (!userKey) {
      userKey = (await getAiKeyFromDb(user.id, toolId)) ?? undefined;
      if (userKey) {
        if (!userAiKeys.has(user.id)) userAiKeys.set(user.id, new Map());
        userAiKeys.get(user.id)!.set(toolId, userKey);
      }
    }
    if (toolId === "openai" && !userKey && !process.env.OPENAI_API_KEY) {
      return reply.status(400).send({ error: "API key missing for openai" });
    }
    if (toolId !== "openai" && !userKey) {
      return reply.status(400).send({ error: `API key missing for ${toolId}` });
    }
    try {
      const replyText = await generalChatWithTool(combined, toolId, userKey);
      return reply.send({ message: replyText || "OK" });
    } catch (err) {
      return reply
        .status(502)
        .send({ error: err instanceof Error ? err.message : "AI failed" });
    }
  }

  const pending = pendingAdds.get(user.id);
  if (pending) {
    const accessToken = await getGoogleAccessToken(user.id);
    if (!accessToken) {
      pendingAdds.delete(user.id);
    } else {
      if (pending.stage === "need_due") {
        const due = inferDueFromText(body.text);
        if (!due) {
          return reply.send({
            command: { action: "add_task", title: pending.title },
            message: "When is this due? (today, tomorrow, or a date)"
          });
        }
        pending.due = due;
        pending.stage = "need_notes";
        pendingAdds.set(user.id, pending);
        return reply.send({
          command: { action: "add_task", title: pending.title, due },
          message: "Add a description/notes? (reply with text or type 'skip')"
        });
      }

      if (pending.stage === "need_notes") {
        const text = body.text.trim();
        if (text.toLowerCase() !== "skip" && text.toLowerCase() !== "no") {
          pending.notes = text;
        }
        pending.stage = "need_list";
        pendingAdds.set(user.id, pending);
      }

      const lists = await getGoogleLists(user.id);
      const choiceText = body.text.trim().toLowerCase();
      let chosenListId: string | undefined;
      const byNumber = Number(choiceText);
      if (!Number.isNaN(byNumber) && byNumber >= 1 && byNumber <= lists.length) {
        chosenListId = lists[byNumber - 1]?.id;
      } else {
        const match = lists.find((l) => l.title.toLowerCase() === choiceText);
        if (match) chosenListId = match.id;
        else {
          const contains = lists.find((l) =>
            choiceText.includes(l.title.toLowerCase())
          );
          if (contains) chosenListId = contains.id;
        }
      }
      if (chosenListId) {
        const res = await fetch(
          `https://tasks.googleapis.com/tasks/v1/lists/${chosenListId}/tasks`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              title: pending.title,
              notes: pending.notes,
              due: pending.due
            })
          }
        );
        pendingAdds.delete(user.id);
        if (!res.ok) {
          return reply
            .status(502)
            .send({ error: "Google Tasks API error", status: res.status });
        }
        const item = (await res.json()) as { id: string; title: string };
        return reply.send({
          command: { action: "add_task", title: pending.title, listId: chosenListId },
          message: `Added task: ${item.title}`
        });
      }
      const choices = lists.map((l, i) => `${i + 1}) ${l.title}`).join(", ");
      return reply.send({
        command: { action: "add_task", title: pending.title },
        message: `Please reply with a list number or exact list name: ${choices}`
      });
    }
  }

  let command: ChatCommand;
  let userKey = userAiKeys.get(user.id)?.get(toolId);
  try {
    if (!userKey) {
      userKey = (await getAiKeyFromDb(user.id, toolId)) ?? undefined;
      if (userKey) {
        if (!userAiKeys.has(user.id)) userAiKeys.set(user.id, new Map());
        userAiKeys.get(user.id)!.set(toolId, userKey);
      }
    }
    if (toolId === "openai" && !userKey && !process.env.OPENAI_API_KEY) {
      return reply.status(400).send({ error: "API key missing for openai" });
    }
    if (toolId !== "openai" && !userKey) {
      return reply.status(400).send({ error: `API key missing for ${toolId}` });
    }
    command = await parseCommandWithTool(body.text, toolId, userKey);
  } catch (err) {
    if (err instanceof Error && err.message.includes("API key missing")) {
      return reply.status(400).send({ error: err.message });
    }
    if (looksLikeTaskQuery(body.text)) {
      command = naiveParse(body.text);
    } else {
      try {
        const replyText = await generalChatWithTool(body.text, toolId, userKey);
        return reply.send({ message: replyText || "OK" });
      } catch (chatErr) {
        return reply.status(502).send({
          error: chatErr instanceof Error ? chatErr.message : "AI failed"
        });
      }
    }
  }
  if (hasTomorrow(body.text)) {
    if (command.action === "list_today") {
      command = { ...command, action: "search_tasks", query: "tomorrow" };
    } else if (command.action === "search_tasks" && !command.query) {
      command = { ...command, query: "tomorrow" };
    }
  } else if (hasToday(body.text)) {
    if (command.action === "search_tasks" && !command.query) {
      command = { ...command, action: "list_today" };
    }
  }
  if (command.action === "add_task") {
    if (!command.title) {
      command.title = inferTitleFromText(body.text);
    }
    if (!command.due) {
      command.due = inferDueFromText(body.text);
    }
    if (!command.title) {
      return reply.status(400).send({ error: "Task title required." });
    }
    if (!command.due) {
      pendingAdds.set(user.id, {
        title: command.title,
        notes: command.notes,
        createdAt: Date.now(),
        stage: "need_due"
      });
      return reply.send({
        command,
        message: "When is this due? (today, tomorrow, or a date)"
      });
    }
    if (!command.notes) {
      pendingAdds.set(user.id, {
        title: command.title,
        due: command.due,
        createdAt: Date.now(),
        stage: "need_notes"
      });
      return reply.send({
        command,
        message: "Add a description/notes? (reply with text or type 'skip')"
      });
    }
  }

  const list = await getTasksForAi(user.id);
  let message = "";

  if (command.action === "add_task") {
    const accessToken = await getGoogleAccessToken(user.id);
    if (accessToken) {
      const lists = await getGoogleLists(user.id);
      const listId = command.listId;
      if (!listId) {
        if (!lists.length) {
          return reply.status(400).send({ error: "No Google task list available." });
        }
        pendingAdds.set(user.id, {
          title: command.title ?? "Untitled",
          notes: command.notes,
          due: command.due,
          createdAt: Date.now()
        });
        const choices = lists.map((l, i) => `${i + 1}) ${l.title}`).join(", ");
        return reply.send({
          command,
          message: `Which list should I add this to? Reply with the list number: ${choices}`
        });
      }
      const res = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: command.title ?? "Untitled",
            notes: command.notes,
            due: command.due
          })
        }
      );
      if (!res.ok) {
        return reply
          .status(502)
          .send({ error: "Google Tasks API error", status: res.status });
      }
      const item = (await res.json()) as { id: string; title: string };
      message = `Added task: ${item.title}`;
    } else {
      return reply.status(400).send({ error: "Google Tasks not connected." });
    }
  } else if (command.action === "complete_task") {
    if (!command.taskId) {
      return reply.status(400).send({ error: "taskId required" });
    }
    const accessToken = await getGoogleAccessToken(user.id);
    const target = list.find((t) => t.id === command.taskId);
    if (accessToken && target?.listId) {
      const res = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/${target.listId}/tasks/${target.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status: "completed" })
        }
      );
      if (!res.ok) {
        return reply
          .status(502)
          .send({ error: "Google Tasks API error", status: res.status });
      }
      message = `Completed task: ${target.title}`;
    } else {
      const local = tasks.get(user.id) ?? [];
      const idx = local.findIndex((t) => t.id === command.taskId);
      if (idx >= 0) {
        local[idx] = {
          ...local[idx],
          completed: true,
          updatedAt: new Date().toISOString()
        };
        tasks.set(user.id, local);
        message = `Completed task: ${local[idx].title}`;
      }
    }
  } else if (command.action === "delete_task") {
    if (!command.taskId) {
      const q = (command.query ?? body.text ?? "").toLowerCase();
      if (q.includes("tomorrow")) {
        const targets = list.filter((t) => isTomorrow(t.due));
        if (!targets.length) {
          return reply.send({ command, message: "No tasks due tomorrow." });
        }
        const accessToken = await getGoogleAccessToken(user.id);
        if (accessToken) {
          for (const t of targets) {
            if (!t.listId) continue;
            await fetch(
              `https://tasks.googleapis.com/tasks/v1/lists/${t.listId}/tasks/${t.id}`,
              { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
            );
          }
        }
        message = `Deleted ${targets.length} tasks due tomorrow.`;
        return reply.send({ command, message });
      }
      const last = lastSearchResults.get(user.id) ?? [];
      if (last.length === 1) {
        command.taskId = last[0];
      } else if (last.length > 1) {
        return reply.send({
          command,
          message: `Which task should I delete? Reply with a number 1-${last.length}.`
        });
      } else {
        return reply.status(400).send({ error: "taskId required" });
      }
    }
    const accessToken = await getGoogleAccessToken(user.id);
    const target = list.find((t) => t.id === command.taskId);
    if (accessToken && target?.listId) {
      const res = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/${target.listId}/tasks/${target.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      if (!res.ok) {
        return reply
          .status(502)
          .send({ error: "Google Tasks API error", status: res.status });
      }
      message = "Deleted task";
    } else {
      tasks.set(
        user.id,
        (tasks.get(user.id) ?? []).filter((t) => t.id !== command.taskId)
      );
      message = "Deleted task";
    }
  } else if (command.action === "list_today") {
    const todayTasks = list.filter((t) => isToday(t.due) && !t.completed);
    lastSearchResults.set(
      user.id,
      todayTasks.map((t) => t.id)
    );
    if (todayTasks.length) {
      message = `Today: ${todayTasks.length} task${
        todayTasks.length === 1 ? "" : "s"
      }: ${todayTasks.slice(0, 5).map((t) => t.title).join(", ")}${
        todayTasks.length > 5 ? "..." : ""
      }`;
    } else {
      message = "No tasks due today.";
    }
  } else if (command.action === "search_tasks") {
    const q = (command.query ?? "").toLowerCase();
    let results = q
      ? list.filter((t) => t.title.toLowerCase().includes(q))
      : list;
    if (q.includes("tomorrow")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      results = list.filter((t) => isSameDay(t.due, tomorrow));
    }
    lastSearchResults.set(
      user.id,
      results.map((t) => t.id)
    );
    if (!q) {
      message = `Showing ${results.length} tasks.`;
    } else if (results.length) {
      message = `Found ${results.length} task${results.length === 1 ? "" : "s"}: ${results
        .slice(0, 5)
        .map((t) => t.title)
        .join(", ")}${results.length > 5 ? "..." : ""}`;
    } else {
      const toolId = body.toolId ?? "openai";
      let userKey = userAiKeys.get(user.id)?.get(toolId);
      if (!userKey) {
        userKey = (await getAiKeyFromDb(user.id, toolId)) ?? undefined;
        if (userKey) {
          if (!userAiKeys.has(user.id)) userAiKeys.set(user.id, new Map());
          userAiKeys.get(user.id)!.set(toolId, userKey);
        }
      }
      try {
        const replyText = await generalChatWithTool(body.text, toolId, userKey);
        message = replyText || "No matching tasks found.";
      } catch {
        message = "No matching tasks found.";
      }
    }
  } else if (command.action === "check_availability_now") {
    message = "Calendar not connected. Enable Google Calendar to check availability.";
  } else {
    message = "Command received";
  }

  return {
    command,
    message,
    tasks: list
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

app.get("/ai/tools", async (_req, reply) => {
  return reply.send({ tools: aiTools });
});

app.post("/ai/keys", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const body = req.body as { toolId?: string; apiKey?: string };
  if (!body?.toolId || !body?.apiKey) {
    return reply.status(400).send({ error: "toolId and apiKey required" });
  }
  if (!aiTools.find((t) => t.id === body.toolId)) {
    return reply.status(400).send({ error: "Unknown tool" });
  }
  try {
    await saveAiKeyToDb(user.id, body.toolId, body.apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save API key.";
    return reply.status(500).send({ error: message });
  }
  if (!userAiKeys.has(user.id)) userAiKeys.set(user.id, new Map());
  userAiKeys.get(user.id)!.set(body.toolId, body.apiKey);
  return reply.send({ ok: true });
});

app.delete("/ai/keys", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const toolId = (req.query as { toolId?: string }).toolId ?? "";
  if (!toolId) return reply.status(400).send({ error: "toolId required" });
  if (!aiTools.find((t) => t.id === toolId)) {
    return reply.status(400).send({ error: "Unknown tool" });
  }
  try {
    if (dbPool) {
      await deleteAiKeyFromDb(user.id, toolId);
    }
    const userMap = userAiKeys.get(user.id);
    if (userMap) userMap.delete(toolId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete API key.";
    return reply.status(500).send({ error: message });
  }
  return reply.send({ ok: true });
});

app.get("/ai/keys", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const tools = await getConfiguredToolSlugs(user.id);
  if (process.env.OPENAI_API_KEY && !tools.includes("openai")) {
    tools.push("openai");
  }
  return reply.send({ tools });
});

app.post("/ai/test", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const body = req.body as { toolId?: string; apiKey?: string };
  const toolId = body?.toolId ?? "";
  if (!toolId) return reply.status(400).send({ error: "toolId required" });
  if (!aiTools.find((t) => t.id === toolId)) {
    return reply.status(400).send({ error: "Unknown tool" });
  }
  const providedKey = body?.apiKey?.trim();
  let key = providedKey;
  if (!key) {
    key = userAiKeys.get(user.id)?.get(toolId) ?? (await getAiKeyFromDb(user.id, toolId)) ?? "";
  }
  if (toolId !== "openai" && !key) {
    return reply.status(400).send({ error: `API key missing for ${toolId}` });
  }
  try {
    await parseCommandWithTool(
      "List my tasks due today.",
      toolId,
      key || undefined
    );
    return reply.send({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI test failed";
    return reply.status(502).send({ ok: false, error: message });
  }
});

app.get("/ai/models", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const toolId = (req.query as { toolId?: string }).toolId ?? "";
  if (!toolId) return reply.status(400).send({ error: "toolId required" });
  if (toolId !== "google") {
    return reply.status(400).send({ error: "Model listing only supported for Google" });
  }
  const key =
    userAiKeys.get(user.id)?.get("google") ?? (await getAiKeyFromDb(user.id, "google"));
  if (!key) return reply.status(400).send({ error: "API key missing for google" });
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models",
    {
      headers: { "x-goog-api-key": key }
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return reply
      .status(res.status)
      .send({ error: `Gemini error: ${res.status} - ${errText.slice(0, 200)}` });
  }
  const data = (await res.json()) as { models?: Array<{ name?: string }> };
  const models = (data.models ?? [])
    .map((m) => m.name)
    .filter((name): name is string => Boolean(name));
  return reply.send({ models });
});

app.get("/google/status", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const tokens = userTokens.get(user.id);
  if (tokens?.refresh_token || tokens?.access_token) {
    return { connected: true };
  }
  const dbTokens = await getOAuthTokensFromDb(user.id);
  return { connected: Boolean(dbTokens?.refresh_token || dbTokens?.access_token) };
});

app.get("/google/ping", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const accessToken = await getGoogleAccessToken(user.id);
  if (!accessToken) {
    return { connected: false, ok: false, reason: "not_connected" };
  }
  const res = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    return { connected: true, ok: false, status: res.status };
  }
  return { connected: true, ok: true };
});

app.get("/google/profile", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const accessToken = await getGoogleAccessToken(user.id);
  if (!accessToken) {
    return reply.status(400).send({ error: "Google not connected" });
  }
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    return reply.status(400).send({ error: "Failed to fetch Google profile" });
  }
  const data = await res.json();
  return {
    name: data.name,
    email: data.email,
    picture: data.picture
  };
});

app.post("/google/link", async (req, reply) => {
  const user = requireAuth(req);
  if (!user) return reply.status(401).send({ error: "Unauthorized" });
  const body = req.body as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
    scope?: string;
  };
  if (!body?.access_token) {
    return reply.status(400).send({ error: "access_token required" });
  }
  const expiresAt =
    body.expires_at ??
    (body.expires_in ? Date.now() + body.expires_in * 1000 : undefined);
  userTokens.set(user.id, {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: expiresAt,
    expires_in: body.expires_in
  });
  try {
    await saveOAuthTokensToDb({
      userId: user.id,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      scope: body.scope,
      expiresAt
    });
  } catch {
    // ignore db save errors for now
  }
  return reply.send({ ok: true });
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
