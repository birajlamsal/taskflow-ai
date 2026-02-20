"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SettingsScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("Connect Google Tasks to sync lists.");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const access = data.session?.access_token ?? null;
      setToken(access);
      if (!access) router.replace("/login");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const access = session?.access_token ?? null;
      setToken(access);
      if (!access) router.replace("/login");
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  async function connectGoogle() {
    if (!token) return;
    setMessage("Starting Google OAuth...");
    try {
      const res = await fetch(`${API_URL}/auth/google/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Failed with ${res.status}`);
      }
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      setMessage(data.error ?? "Unable to start Google OAuth.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to start Google OAuth.");
    }
  }

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div
          className="glass rounded-3xl p-8 space-y-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Settings
            </p>
            <h1 className="text-3xl font-semibold">Connections</h1>
          </div>

          <div className="glass rounded-2xl p-5 space-y-3">
            <p className="text-sm text-white/70">Google Tasks</p>
            <p className="text-sm text-white/60">
              Connect your Google account to sync task lists and tasks.
            </p>
            <button
              onClick={connectGoogle}
              className="glass px-5 py-2 rounded-full text-sm"
            >
              Connect Google
            </button>
            <p className="text-xs text-white/60">{message}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
