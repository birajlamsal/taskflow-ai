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
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<{
    name?: string;
    email?: string;
    picture?: string;
  } | null>(null);
  const [aiTools, setAiTools] = useState<Array<{ id: string; name: string }>>([]);
  const [aiKeys, setAiKeys] = useState<Record<string, string>>({});
  const [aiKeyVisible, setAiKeyVisible] = useState<Record<string, boolean>>({});
  const [savedTools, setSavedTools] = useState<Set<string>>(new Set());
  const [aiStatus, setAiStatus] = useState<string | null>(null);

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

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${API_URL}/google/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setGoogleConnected(false);
          return;
        }
        const data = (await res.json()) as { connected?: boolean };
        const connected = Boolean(data.connected);
        setGoogleConnected(connected);
        if (connected) {
          const profileRes = await fetch(`${API_URL}/google/profile`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (profileRes.ok) {
            const profileData = (await profileRes.json()) as {
              name?: string;
              email?: string;
              picture?: string;
            };
            if (active) setProfile(profileData);
          }
        } else {
          setProfile(null);
        }
      })
      .catch(() => {
        if (!active) return;
        setGoogleConnected(false);
        setProfile(null);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/ai/tools`)
      .then(async (res) => {
        if (!active) return;
        const data = await res.json();
        setAiTools(Array.isArray(data.tools) ? data.tools : []);
      })
      .catch(() => {
        if (!active) return;
        setAiTools([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveAiKey(toolId: string) {
    if (!token) return;
    const apiKey = aiKeys[toolId]?.trim() ?? "";
    if (!apiKey) {
      setAiStatus("API key is required.");
      return;
    }
    const res = await fetch(`${API_URL}/ai/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ toolId, apiKey })
    });
    const data = await res.json();
    if (!res.ok) {
      setAiStatus(data?.error ?? "Failed to save API key.");
      return;
    }
    setAiStatus("Saved.");
    setAiKeys((prev) => ({ ...prev, [toolId]: "" }));
    setSavedTools((prev) => new Set([...prev, toolId]));
  }

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
            <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
              Settings
            </p>
            <h1 className="text-3xl font-semibold">Connections</h1>
          </div>

          <div className="glass rounded-2xl p-5 space-y-3">
            <p className="text-sm text-ink-600">Google Tasks</p>
            <p className="text-sm text-ink-500">
              Connect your Google account to sync task lists and tasks.
            </p>
            {googleConnected ? (
              <div className="flex items-center gap-3 rounded-2xl bg-ink-900/5 px-3 py-2">
                {profile?.picture ? (
                  <img
                    src={profile.picture}
                    alt="Profile"
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-ink-900/10" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {profile?.name ?? "Connected"}
                  </p>
                  <p className="text-xs text-ink-500">{profile?.email ?? ""}</p>
                </div>
              </div>
            ) : null}
            <button
              onClick={connectGoogle}
              className="glass px-5 py-2 rounded-full text-sm"
            >
              {googleConnected ? "Reconnect Google" : "Connect Google"}
            </button>
            <p className="text-xs text-ink-500">{message}</p>
          </div>

          {googleConnected ? (
            <div className="glass rounded-2xl p-5 space-y-3">
              <p className="text-sm text-ink-600">AI Tools</p>
              <p className="text-sm text-ink-500">
                Add your AI provider API key to enable chat. Tools with keys saved
                are hidden.
              </p>
              <div className="space-y-3">
                {(aiTools.length ? aiTools : [{ id: "openai", name: "OpenAI" }])
                  .filter((tool) => !savedTools.has(tool.id))
                  .map((tool) => (
                    <div
                      key={tool.id}
                      className="flex flex-col gap-2 rounded-2xl bg-ink-900/5 p-3"
                    >
                      <p className="text-sm font-medium">{tool.name}</p>
                      <div className="relative">
                        <input
                          type={aiKeyVisible[tool.id] ? "text" : "password"}
                          value={aiKeys[tool.id] ?? ""}
                          onChange={(e) =>
                            setAiKeys((prev) => ({ ...prev, [tool.id]: e.target.value }))
                          }
                          placeholder={`Paste ${tool.name} API key`}
                          className="w-full rounded-2xl bg-white/70 px-3 py-2 pr-12 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setAiKeyVisible((prev) => ({
                              ...prev,
                              [tool.id]: !prev[tool.id]
                            }))
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-ink-900/10 px-3 py-1 text-xs"
                        >
                          {aiKeyVisible[tool.id] ? "Hide" : "Show"}
                        </button>
                      </div>
                      <button
                        onClick={() => saveAiKey(tool.id)}
                        className="glass px-4 py-2 rounded-full text-sm"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                {aiTools.length > 0 &&
                aiTools.every((tool) => savedTools.has(tool.id)) ? (
                  <p className="text-sm text-ink-500">All tools are configured.</p>
                ) : null}
              </div>
              {aiStatus ? <p className="text-xs text-ink-500">{aiStatus}</p> : null}
            </div>
          ) : (
            <div className="glass rounded-2xl p-5 space-y-2">
              <p className="text-sm text-ink-600">AI Tools</p>
              <p className="text-sm text-ink-500">
                Connect Google first to enable AI tool setup.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
