"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const router = useRouter();
  const [message, setMessage] = useState("Sign in with your email and password.");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) router.replace("/");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/");
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  async function connect() {
    setLoading(true);
    try {
      if (!email || !password) {
        setMessage("Email and password required.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMessage("Signed in. Redirecting...");
      router.replace("/");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Auth failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="glass rounded-3xl p-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-500">
              TaskFlow Auth
            </p>
            <h1 className="text-4xl font-semibold leading-tight">
              Connect Google Tasks securely.
            </h1>
            <p className="text-ink-600">
              Auth is handled by Supabase. Your session token is used to access
              the API securely.
            </p>
            <div className="space-y-3">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg bg-ink-900/5 px-3 py-2 text-sm"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                className="w-full rounded-lg bg-ink-900/5 px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={connect}
              disabled={loading}
              className="glass px-6 py-3 rounded-full text-sm disabled:opacity-60"
            >
              {loading ? "Working..." : "Sign in"}
            </button>
            <p className="text-xs text-ink-500">{message}</p>
          </div>

          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-ink-600">Stored server-side</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-500">
                <li>Encrypted Google refresh token</li>
                <li>User profile (email + name)</li>
                <li>Optional AI provider API key</li>
              </ul>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-ink-600">Need the schema?</p>
              <p className="mt-2 text-sm text-ink-500">
                See `apps/server/sql/supabase_schema.sql` for Supabase SQL.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
