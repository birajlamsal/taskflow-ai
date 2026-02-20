"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginScreen() {
  const [message, setMessage] = useState("Connect your Google account.");
  const [loading, setLoading] = useState(false);

  async function connect() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/google/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "mock" })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("taskflow_token", data.token);
        setMessage("Connected. Tokens stored on the server.");
        window.location.href = "/";
      } else {
        setMessage(data.error ?? "Connection failed.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Connection failed.");
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
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              TaskFlow Auth
            </p>
            <h1 className="text-4xl font-semibold leading-tight">
              Connect Google Tasks securely.
            </h1>
            <p className="text-white/70">
              OAuth tokens are stored on the server in the database. This app
              never stores secrets in the browser.
            </p>
            <button
              onClick={connect}
              disabled={loading}
              className="glass px-6 py-3 rounded-full text-sm disabled:opacity-60"
            >
              {loading ? "Connecting..." : "Connect Google"}
            </button>
            <p className="text-xs text-white/60">{message}</p>
          </div>

          <div className="space-y-4">
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-white/70">What gets stored</p>
              <ul className="mt-3 space-y-2 text-sm text-white/60">
                <li>Encrypted Google refresh token</li>
                <li>User profile (email + name)</li>
                <li>Optional AI provider API key</li>
              </ul>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-white/70">Need the schema?</p>
              <p className="mt-2 text-sm text-white/60">
                See `apps/server/sql/supabase_schema.sql` for Supabase SQL.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
