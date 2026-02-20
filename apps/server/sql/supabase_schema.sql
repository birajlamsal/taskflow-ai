-- TaskFlow: Supabase schema for users, OAuth tokens, and AI keys.
-- Enable pgcrypto for encryption helpers.
create extension if not exists pgcrypto;

-- Users table
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  picture_url text,
  created_at timestamptz not null default now()
);

-- OAuth accounts (Google)
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

-- AI provider keys (per user)
create table if not exists public.ai_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  api_key_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- Helpful index
create index if not exists idx_oauth_accounts_user on public.oauth_accounts(user_id);
create index if not exists idx_ai_keys_user on public.ai_provider_keys(user_id);

-- Example encrypt/decrypt usage (run in app code, not in SQL migrations):
-- select pgp_sym_encrypt('token', '<ENCRYPTION_KEY>');
-- select pgp_sym_decrypt(refresh_token_encrypted::bytea, '<ENCRYPTION_KEY>');
