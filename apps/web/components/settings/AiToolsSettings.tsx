"use client";

import { useEffect, useState } from "react";
import { useSettingsAuth } from "./SettingsLayout";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AiToolsSettings() {
  const { token } = useSettingsAuth();
  const [aiTools, setAiTools] = useState<Array<{ id: string; name: string }>>([]);
  const [aiKeys, setAiKeys] = useState<Record<string, string>>({});
  const [aiKeyVisible, setAiKeyVisible] = useState<Record<string, boolean>>({});
  const [savedTools, setSavedTools] = useState<Set<string>>(new Set());
  const [editingTools, setEditingTools] = useState<Set<string>>(new Set());
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiTestStatus, setAiTestStatus] = useState<Record<string, string>>({});
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);

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

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${API_URL}/ai/keys`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setSavedTools(new Set());
          return;
        }
        const data = (await res.json()) as { tools?: string[] };
        const tools = Array.isArray(data.tools) ? data.tools : [];
        setSavedTools(new Set(tools));
      })
      .catch(() => {
        if (!active) return;
        setSavedTools(new Set());
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${API_URL}/google/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!active) return;
        const data = res.ok ? await res.json() : { connected: false };
        setGoogleConnected(Boolean(data.connected));
      })
      .catch(() => {
        if (!active) return;
        setGoogleConnected(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

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

  async function testAiKey(toolId: string) {
    if (!token) return;
    setAiTestStatus((prev) => ({ ...prev, [toolId]: "Testing..." }));
    const res = await fetch(`${API_URL}/ai/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ toolId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAiTestStatus((prev) => ({
        ...prev,
        [toolId]: data?.error ?? "Test failed"
      }));
      return;
    }
    setAiTestStatus((prev) => ({ ...prev, [toolId]: "Working" }));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Settings</p>
        <h1 className="text-3xl font-semibold">AI Tools</h1>
      </div>

      {googleConnected ? (
        <div className="rounded-2xl bg-ink-900/5 p-5 space-y-3">
          <p className="text-sm text-ink-600">Providers</p>
          <p className="text-sm text-ink-500">
            Add your AI provider API key to enable chat. Credentials will be hidden
            after saving.
          </p>
          <div className="space-y-3">
            {(aiTools.length ? aiTools : [{ id: "openai", name: "OpenAI" }]).map(
              (tool) => {
                const saved = savedTools.has(tool.id);
                const editing = editingTools.has(tool.id);
                return (
                  <div
                    key={tool.id}
                    className="flex flex-col gap-2 rounded-2xl bg-ink-900/5 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{tool.name}</p>
                      <div className="flex items-center gap-2">
                        {saved ? (
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700">
                            Saved
                          </span>
                        ) : null}
                        {saved ? (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingTools((prev) => {
                                const next = new Set(prev);
                                if (next.has(tool.id)) next.delete(tool.id);
                                else next.add(tool.id);
                                return next;
                              })
                            }
                            className="rounded-full bg-ink-900/10 px-3 py-1 text-xs"
                          >
                            {editing ? "Cancel" : "Edit"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type={aiKeyVisible[tool.id] ? "text" : "password"}
                        value={
                          saved && !editing ? "••••••••••••••••" : aiKeys[tool.id] ?? ""
                        }
                        onChange={(e) =>
                          setAiKeys((prev) => ({ ...prev, [tool.id]: e.target.value }))
                        }
                        placeholder={`Paste ${tool.name} API key`}
                        className={`w-full rounded-2xl px-3 py-2 pr-12 text-sm ${
                          saved && !editing
                            ? "bg-ink-900/10 text-ink-500"
                            : "bg-white/70"
                        }`}
                        disabled={saved && !editing}
                        readOnly={saved && !editing}
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
                        disabled={saved && !editing}
                      >
                        {aiKeyVisible[tool.id] ? "Hide" : "Show"}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => saveAiKey(tool.id)}
                        className="glass px-4 py-2 rounded-full text-sm"
                        disabled={saved && !editing}
                      >
                        {saved ? (editing ? "Update" : "Added") : "Add"}
                      </button>
                      {saved && !editing ? (
                        <button
                          onClick={() => testAiKey(tool.id)}
                          className="rounded-full bg-ink-900/10 px-4 py-2 text-sm"
                        >
                          Test
                        </button>
                      ) : null}
                    </div>
                    {aiTestStatus[tool.id] ? (
                      <p className="text-xs text-ink-500">{aiTestStatus[tool.id]}</p>
                    ) : null}
                  </div>
                );
              }
            )}
          </div>
          {aiStatus ? <p className="text-xs text-ink-500">{aiStatus}</p> : null}
        </div>
      ) : (
        <div className="rounded-2xl bg-ink-900/5 p-5 space-y-2">
          <p className="text-sm text-ink-600">AI Tools</p>
          <p className="text-sm text-ink-500">
            Connect Google first to enable AI tool setup.
          </p>
        </div>
      )}
    </div>
  );
}
