# TaskFlow AI

A monorepo base that mirrors the TaskFlow desktop app behavior with web + mobile clients and a shared backend.

## Structure
- `apps/web` - Next.js App Router + Tailwind + Framer Motion
- `apps/mobile` - Expo + React Native
- `apps/kotlinapp` - Native Android (Kotlin, Compose, Hilt, Retrofit)
- `apps/server` - Fastify backend
- `packages/shared` - types, zod schemas, provider interfaces

## Quickstart

```bash
pnpm install
pnpm -C apps/server dev
pnpm -C apps/web dev
pnpm -C apps/mobile dev
```

Server defaults to `http://localhost:4000` and uses mock auth unless `USE_MOCK_AUTH=false`.

## Environment
Copy `apps/server/.env.example` to `apps/server/.env` and set:
- `SESSION_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `OPENAI_API_KEY` (optional, enables real AI parsing)

Clients can override API URL:
- Web: `NEXT_PUBLIC_API_URL`
- Mobile: `EXPO_PUBLIC_API_URL`

Supabase Auth env placeholders:
- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Server: `SUPABASE_JWT_SECRET` (used to verify JWTs)

## Notes
- OAuth and Google Tasks are handled via Supabase Google sign-in (web + mobile).
- AI command uses user-provided API keys; no global fallback key required.
- Expo app currently has device/runtime issues; the Kotlin app is the recommended mobile client until Expo is stable.

## Database schema (Supabase)
SQL is provided in `table_formation/taskflow_supabase.sql` for:
- `users`
- `oauth_accounts` (encrypted Google tokens)
- `ai_provider_keys` (encrypted per-user AI API keys)
