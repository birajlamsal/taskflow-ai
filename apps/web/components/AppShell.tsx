"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TaskList = { id: string; title: string };
type Task = {
  id: string;
  listId: string;
  title: string;
  completed?: boolean;
  due?: string;
};

export default function AppShell() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeList, setActiveList] = useState<string>("inbox");
  const [input, setInput] = useState("");
  const [chat, setChat] = useState("");
  const [message, setMessage] = useState("Connect to start.");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setToken(data.session?.access_token ?? null);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!token) {
      router.push("/login");
    }
  }, [token, authChecked, router]);

  async function connect() {
    setMessage("Use the Login page to authenticate.");
  }

  async function loadLists(t = token) {
    if (!t) return;
    const res = await fetch(`${API_URL}/tasklists`, {
      headers: { Authorization: `Bearer ${t}` }
    });
    const data = await res.json();
    const safe = Array.isArray(data) ? data : [];
    setLists(safe);
    if (safe[0]) setActiveList(safe[0].id);
  }

  async function loadTasks(listId = activeList, t = token) {
    if (!t || !listId) return;
    const res = await fetch(`${API_URL}/tasklists/${listId}/tasks`, {
      headers: { Authorization: `Bearer ${t}` }
    });
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (token) {
      loadLists(token);
    }
  }, [token]);

  useEffect(() => {
    if (token && activeList) {
      loadTasks(activeList, token);
    }
  }, [activeList, token]);

  async function addTask() {
    if (!token || !input.trim()) return;
    const res = await fetch(`${API_URL}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title: input, listId: activeList })
    });
    const data = await res.json();
    setTasks((prev) => [...prev, data]);
    setInput("");
  }

  async function sendChat() {
    if (!token || !chat.trim()) return;
    const res = await fetch(`${API_URL}/ai/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ text: chat })
    });
    const data = await res.json();
    setMessage(data.message ?? "Command executed");
    if (Array.isArray(data.tasks)) setTasks(data.tasks);
    setChat("");
  }

  const completedCount = useMemo(
    () => (Array.isArray(tasks) ? tasks.filter((t) => t.completed).length : 0),
    [tasks]
  );

  if (!authChecked) {
    return null;
  }

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">
              TaskFlow
            </p>
            <h1 className="text-3xl font-semibold">Flow through tasks.</h1>
          </div>
          {token ? (
            <div className="flex items-center gap-3">
              <a
                href="/settings"
                className="text-sm text-white/70 hover:text-white"
              >
                Settings
              </a>
              <div className="text-sm text-white/70">Connected</div>
            </div>
          ) : (
            <div className="text-sm text-white/70">Redirecting to login…</div>
          )}
        </header>

        <motion.section
          className="glass rounded-2xl p-6 grid md:grid-cols-[220px_1fr] gap-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-3">
            <p className="text-xs text-white/50 uppercase">Lists</p>
            <div className="space-y-2">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => setActiveList(list.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition ${
                    activeList === list.id
                      ? "bg-white/20"
                      : "hover:bg-white/10"
                  }`}
                >
                  {list.title}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/70">
                {tasks.length} tasks • {completedCount} done
              </p>
              <p className="text-xs text-white/50">{message}</p>
            </div>

            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Add a task"
                className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm"
              />
              <button onClick={addTask} className="glass px-4 rounded-lg">
                Add
              </button>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-auto">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="glass rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.due && (
                      <p className="text-xs text-white/50">Due {task.due}</p>
                    )}
                  </div>
                  <span className="text-xs text-white/60">
                    {task.completed ? "Done" : "Open"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          className="glass rounded-2xl p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <p className="text-sm text-white/70 mb-3">AI Assistant</p>
          <div className="flex gap-2">
            <input
              value={chat}
              onChange={(e) => setChat(e.target.value)}
              placeholder="Ask TaskFlow..."
              className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm"
            />
            <button onClick={sendChat} className="glass px-4 rounded-lg">
              Send
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
