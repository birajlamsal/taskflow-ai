-- TaskFlow schema for Supabase (Postgres)
-- Stores users, OAuth tokens, sessions, and AI provider keys.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key,
  email text unique not null,
  name text,
  picture_url text,
  created_at timestamptz not null default now()
);

-- Keep public.users in sync with auth.users
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.users (id, email, name, picture_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        name = excluded.name,
        picture_url = excluded.picture_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Ensure function owner has permission to insert into public.users
-- In Supabase SQL editor, run as postgres or service role.

create table if not exists public.oauth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  refresh_token_encrypted text not null,
  access_token_encrypted text,
  scope text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- Session tokens for API auth (optional but recommended for multi-user)
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_token text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Catalog of supported AI tools (extensible)
create table if not exists public.ai_tools (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  base_url text,
  created_at timestamptz not null default now()
);

-- Store AI provider keys per user (encrypted)
create table if not exists public.ai_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tool_id uuid not null references public.ai_tools(id) on delete cascade,
  api_key_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tool_id)
);

-- PKCE auth state (optional but useful for CSRF protection)
create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  state text unique not null,
  code_verifier_encrypted text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_oauth_accounts_user on public.oauth_accounts(user_id);
create index if not exists idx_ai_keys_user on public.ai_provider_keys(user_id);
create index if not exists idx_ai_keys_tool on public.ai_provider_keys(tool_id);
create index if not exists idx_sessions_user on public.sessions(user_id);
create index if not exists idx_oauth_states_user on public.oauth_states(user_id);

-- Seed 5 popular AI tools (idempotent)
insert into public.ai_tools (slug, display_name, base_url)
values
  ('openai', 'OpenAI', 'https://api.openai.com'),
  ('anthropic', 'Anthropic', 'https://api.anthropic.com'),
  ('google', 'Google Gemini', 'https://generativelanguage.googleapis.com'),
  ('mistral', 'Mistral', 'https://api.mistral.ai'),
  ('cohere', 'Cohere', 'https://api.cohere.ai')
on conflict (slug) do nothing;
