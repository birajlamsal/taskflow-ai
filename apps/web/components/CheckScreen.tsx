"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Status = {
  server: string;
  db?: { configured?: boolean };
  google?: { clientIdConfigured?: boolean; redirectConfigured?: boolean };
  auth?: { supabaseConfigured?: boolean };
};

export default function CheckScreen() {
  const [frontendOk, setFrontendOk] = useState(true);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [googleUserOk, setGoogleUserOk] = useState<boolean | null>(null);
  const [googleUserDetail, setGoogleUserDetail] = useState<string>("Not checked");

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const res = await fetch(`${API_URL}/status`);
        if (!res.ok) throw new Error(`Backend error: ${res.status}`);
        const data = (await res.json()) as Status;
        if (!active) return;
        setBackendOk(true);
        setStatus(data);
      } catch (err) {
        if (!active) return;
        setBackendOk(false);
        setError(err instanceof Error ? err.message : "Backend unreachable");
      }
    }
    check();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const token = data.session?.access_token;
      if (!token) {
        setGoogleUserOk(null);
        setGoogleUserDetail("Login required");
        return;
      }
      try {
        const res = await fetch(`${API_URL}/google/ping`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
          setGoogleUserOk(false);
          setGoogleUserDetail(data?.error ?? `Error ${res.status}`);
          return;
        }
        setGoogleUserOk(Boolean(data.ok));
        if (!data.connected) {
          setGoogleUserDetail("Google not connected");
        } else if (data.ok) {
          setGoogleUserDetail("Google Tasks reachable");
        } else {
          setGoogleUserDetail(`Google Tasks error${data.status ? ` (${data.status})` : ""}`);
        }
      } catch (err) {
        setGoogleUserOk(false);
        setGoogleUserDetail(err instanceof Error ? err.message : "Request failed");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="glass rounded-3xl p-8 space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Status</p>
            <h1 className="text-3xl font-semibold">System Check</h1>
          </div>

          <div className="space-y-3">
            <StatusRow label="Frontend" ok={frontendOk} detail="Loaded in browser" />
            <StatusRow
              label="Backend"
              ok={backendOk === null ? null : backendOk}
              detail={
                backendOk
                  ? "Connected to API"
                  : error ?? "Not reachable"
              }
            />
            <StatusRow
              label="Database"
              ok={status?.db?.configured ?? null}
              detail={
                status?.db?.configured
                  ? "DATABASE_URL configured"
                  : "DATABASE_URL not set"
              }
            />
            <StatusRow
              label="Supabase Auth"
              ok={status?.auth?.supabaseConfigured ?? null}
              detail={
                status?.auth?.supabaseConfigured
                  ? "JWT secret configured"
                  : "SUPABASE_JWT_SECRET not set"
              }
            />
            <StatusRow
              label="Google OAuth"
              ok={
                (status?.google?.clientIdConfigured ?? false) &&
                (status?.google?.redirectConfigured ?? false)
              }
              detail={
                status?.google?.clientIdConfigured && status?.google?.redirectConfigured
                  ? "Google OAuth configured"
                  : "Google OAuth missing client id or redirect"
              }
            />
            <StatusRow
              label="Google Tasks (User)"
              ok={googleUserOk}
              detail={googleUserDetail}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  detail
}: {
  label: string;
  ok: boolean | null;
  detail: string;
}) {
  const color =
    ok === null ? "text-ink-400" : ok ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="flex items-center justify-between glass rounded-2xl px-4 py-3">
      <div>
        <p className="text-sm text-ink-600">{label}</p>
        <p className="text-xs text-ink-400">{detail}</p>
      </div>
      <span className={`text-xs font-semibold ${color}`}>
        {ok === null ? "Checking..." : ok ? "OK" : "Error"}
      </span>
    </div>
  );
}
