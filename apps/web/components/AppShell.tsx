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
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [activeList, setActiveList] = useState<string>("inbox");
  const [chat, setChat] = useState("");
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [aiTools, setAiTools] = useState<Array<{ id: string; name: string }>>([]);
  const [configuredTools, setConfiguredTools] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState("openai");
  const [message, setMessage] = useState("Connect to start.");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [apiStatus, setApiStatus] = useState<{
    dbConfigured?: boolean;
    authConfigured?: boolean;
  } | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [calendarScope, setCalendarScope] = useState<
    "missed" | "today" | "upcoming" | "completed" | "selected"
  >("selected");
  const [chatOpen, setChatOpen] = useState(true);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [taskStatusEdits, setTaskStatusEdits] = useState<
    Record<string, "open" | "completed">
  >({});
  const [savingTaskIds, setSavingTaskIds] = useState<Record<string, boolean>>({});
  const [aiTyping, setAiTyping] = useState(false);

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
    if (!token) return;
    let active = true;
    fetch(`${API_URL}/google/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setDisplayName(null);
          return;
        }
        const data = (await res.json()) as { name?: string };
        setDisplayName(data.name ?? null);
      })
      .catch(() => {
        if (!active) return;
        setDisplayName(null);
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

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${API_URL}/ai/keys`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setConfiguredTools([]);
          return;
        }
        const data = (await res.json()) as { tools?: string[] };
        setConfiguredTools(Array.isArray(data.tools) ? data.tools : []);
      })
      .catch(() => {
        if (!active) return;
        setConfiguredTools([]);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!configuredTools.length) return;
    if (!configuredTools.includes(selectedTool)) {
      setSelectedTool(configuredTools[0]);
    }
  }, [configuredTools, selectedTool]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${API_URL}/status`)
      .then(async (res) => {
        if (!active) return;
        setApiConnected(res.ok);
        if (!res.ok) return;
        const data = (await res.json()) as {
          db?: { configured?: boolean };
          auth?: { supabaseConfigured?: boolean };
        };
        setApiStatus({
          dbConfigured: data?.db?.configured,
          authConfigured: data?.auth?.supabaseConfigured
        });
      })
      .catch(() => {
        if (!active) return;
        setApiConnected(false);
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
        if (!res.ok) {
          setGoogleConnected(false);
          return;
        }
        const data = (await res.json()) as { connected?: boolean };
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

  useEffect(() => {
    if (!authChecked) return;
    if (!token) {
      router.push("/login");
    }
  }, [token, authChecked, router]);

  useEffect(() => {
    function handleToggle() {
      setChatOpen((prev) => !prev);
    }
    window.addEventListener("taskflow:toggle-chat", handleToggle);
    return () => {
      window.removeEventListener("taskflow:toggle-chat", handleToggle);
    };
  }, []);

  async function connect() {
    setMessage("Use the Login page to authenticate.");
  }

  async function loadLists(t = token) {
    if (!t) return;
    const res = await fetch(`${API_URL}/tasklists`, {
      headers: { Authorization: `Bearer ${t}` }
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data?.error ?? "Failed to load Google task lists.");
      setLists([]);
      return;
    }
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
    if (!res.ok) {
      setMessage(data?.error ?? "Failed to load Google tasks.");
      setTasks([]);
      return;
    }
    setTasks(Array.isArray(data) ? data : []);
  }

  async function loadAllTasks(currentLists = lists, t = token) {
    if (!t || currentLists.length === 0) return;
    const results = await Promise.all(
      currentLists.map(async (list) => {
        const res = await fetch(`${API_URL}/tasklists/${list.id}/tasks`, {
          headers: { Authorization: `Bearer ${t}` }
        });
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      })
    );
    setAllTasks(results.flat());
    setLastSynced(new Date().toISOString());
  }

  useEffect(() => {
    if (token) {
      loadLists(token);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      loadLists(token);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (token && activeList) {
      loadTasks(activeList, token);
    }
  }, [activeList, token]);

  useEffect(() => {
    if (token && lists.length) {
      loadAllTasks(lists, token);
    }
  }, [lists, token]);

  async function sendChat() {
    if (!token || !chat.trim()) return;
    const prompt = chat.trim();
    setChatHistory((prev) => [...prev, { role: "user", text: prompt }]);
    setAiTyping(true);
    const res = await fetch(`${API_URL}/ai/command`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ text: prompt, toolId: selectedTool })
    });
    try {
      const data = await res.json();
      setMessage(data.message ?? "Command executed");
      if (Array.isArray(data.tasks)) setTasks(data.tasks);
      if (data.message) {
        setChatHistory((prev) => [...prev, { role: "assistant", text: data.message }]);
      }
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: "Something went wrong." }
      ]);
    } finally {
      setAiTyping(false);
      setChat("");
    }
  }

  async function saveTaskStatus(taskId: string, listId: string, status: "open" | "completed") {
    if (!token) return;
    setSavingTaskIds((prev) => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          listId,
          completed: status === "completed"
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data?.error ?? "Failed to update task.");
        return;
      }
      const updated = (await res.json()) as Task;
      setAllTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, ...updated } : task))
      );
      setTaskStatusEdits((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    } catch {
      setMessage("Failed to update task.");
    } finally {
      setSavingTaskIds((prev) => ({ ...prev, [taskId]: false }));
    }
  }

  const completedCount = useMemo(
    () => (Array.isArray(allTasks) ? allTasks.filter((t) => t.completed).length : 0),
    [allTasks]
  );

  const filteredTasks = useMemo(() => {
    const result = [...allTasks];
    return result.sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  }, [allTasks]);

  const tasksForSelectedDate = useMemo(() => {
    if (calendarScope === "missed") {
      return allTasks.filter((task) => isBeforeToday(task.due) && !task.completed);
    }
    if (calendarScope === "completed") {
      return allTasks.filter((task) => task.completed);
    }
    if (calendarScope === "today") {
      return allTasks.filter((task) => isToday(task.due) && !task.completed);
    }
    if (calendarScope === "upcoming") {
      return allTasks.filter((task) => isAfterToday(task.due));
    }
    if (!selectedDate) return [];
    const key = toDateKey(selectedDate);
    return allTasks.filter((task) => {
      const taskKey = toTaskDateKey(task.due);
      if (taskKey !== key) return false;
      if (calendarScope === "selected") return true;
      return true;
    });
  }, [allTasks, selectedDate, calendarScope]);

  if (!authChecked) {
    return null;
  }

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-ink-400">
              TaskFlow
            </p>
            <h1 className="text-3xl font-semibold">
              Hello{displayName ? `, ${displayName}` : ""}.
            </h1>
            <p className="text-sm text-ink-500">Flow through tasks.</p>
          </div>
        </header>

        <div className="relative space-y-6">
          <motion.section
            className={`glass rounded-2xl p-6 space-y-4 ${chatOpen ? "lg:pr-[320px]" : ""}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-ink-600">
                    {allTasks.length} tasks • {completedCount} done
                  </p>
                  <p className="text-xs text-ink-400">{message}</p>
                </div>

                {googleConnected ? (
                  <div className="glass rounded-2xl px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
                      Overview
                    </p>
                    <p className="text-lg font-semibold">Task summary</p>
                    <p className="text-xs text-ink-500">
                      {allTasks.length} total • {completedCount} done
                    </p>
                  </div>
                ) : null}

                {apiConnected !== true || apiStatus?.dbConfigured === false ? (
                  <div className="glass rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Connect the API</p>
                      <p className="text-xs text-ink-500">
                        {apiConnected === false
                          ? "Your backend is not reachable."
                          : apiStatus?.dbConfigured === false
                            ? "Database is not configured."
                            : "Complete API configuration in Settings."}
                      </p>
                    </div>
                    <a
                      href="/settings"
                      className="glass px-4 py-2 rounded-full text-sm"
                    >
                      Connect API
                    </a>
                  </div>
                ) : null}

                {googleConnected === false ? (
                  <div className="glass rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Connect Google</p>
                      <p className="text-xs text-ink-500">
                        Link Google Tasks to sync your lists and tasks.
                      </p>
                    </div>
                    <a
                      href="/settings"
                      className="glass px-4 py-2 rounded-full text-sm"
                    >
                      Connect Google
                    </a>
                  </div>
                ) : null}


                <div className="space-y-4">
                  <div className="h-[45vh]">
                    <CalendarView
                      month={calendarMonth}
                      selected={selectedDate ?? undefined}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setCalendarScope("selected");
                      }}
                      onChangeMonth={setCalendarMonth}
                      tasks={allTasks}
                    />
                  </div>
                  <div className="glass rounded-2xl p-4 space-y-4">
                    {googleConnected ? (
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <button
                          onClick={() => {
                            setCalendarScope("missed");
                            setSelectedDate(null);
                          }}
                          className={`rounded-full px-4 py-2 ${
                            calendarScope === "missed"
                              ? "bg-sunset-500/80 text-ink-900"
                              : "bg-white/70 text-ink-700"
                          }`}
                        >
                          Missed
                        </button>
                        <button
                          onClick={() => {
                            setCalendarScope("today");
                            setSelectedDate(null);
                          }}
                          className={`rounded-full px-4 py-2 ${
                            calendarScope === "today"
                              ? "bg-accent-500/80 text-ink-900"
                              : "bg-white/70 text-ink-700"
                          }`}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => {
                            setCalendarScope("upcoming");
                            setSelectedDate(null);
                          }}
                          className={`rounded-full px-4 py-2 ${
                            calendarScope === "upcoming"
                              ? "bg-ink-900/10 text-ink-900"
                              : "bg-white/70 text-ink-700"
                          }`}
                        >
                          Upcoming
                        </button>
                        <button
                          onClick={() => {
                            setCalendarScope("completed");
                            setSelectedDate(null);
                          }}
                          className={`rounded-full px-4 py-2 ${
                            calendarScope === "completed"
                              ? "bg-emerald-500/60 text-ink-900"
                              : "bg-white/70 text-ink-700"
                          }`}
                        >
                          Completed
                        </button>
                        <button
                          onClick={() => {
                            setCalendarScope("selected");
                            setSelectedDate(new Date());
                          }}
                          className={`rounded-full px-4 py-2 ${
                            calendarScope === "selected"
                              ? "bg-ink-900/10 text-ink-900"
                              : "bg-white/70 text-ink-700"
                          }`}
                        >
                          Selected Day
                        </button>
                      </div>
                    ) : null}

                    <div>
                      <p className="text-sm font-medium">
                        {calendarScope === "missed"
                          ? "Missed tasks"
                          : calendarScope === "completed"
                            ? "Completed tasks"
                            : selectedDate
                              ? `Tasks for ${selectedDate.toDateString()}`
                              : "Tasks for selected date"}
                      </p>
                      {tasksForSelectedDate.length ? (
                        <div className="mt-3 space-y-2">
                          {tasksForSelectedDate.map((task) => {
                            const currentStatus = task.completed ? "completed" : "open";
                            const selectedStatus =
                              taskStatusEdits[task.id] ?? currentStatus;
                            const dirty = selectedStatus !== currentStatus;
                            const saving = Boolean(savingTaskIds[task.id]);
                            return (
                              <div key={task.id} className="glass rounded-xl px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium">{task.title}</p>
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={selectedStatus}
                                      onChange={(e) =>
                                        setTaskStatusEdits((prev) => ({
                                          ...prev,
                                          [task.id]: e.target.value as
                                            | "open"
                                            | "completed"
                                        }))
                                      }
                                      className="rounded-lg bg-ink-900/5 px-3 py-2 text-xs"
                                    >
                                      <option value="open">To Do</option>
                                      <option value="completed">Done</option>
                                    </select>
                                    <button
                                      onClick={() =>
                                        saveTaskStatus(task.id, task.listId, selectedStatus)
                                      }
                                      disabled={!dirty || saving}
                                      className="glass px-3 py-2 rounded-lg text-xs disabled:opacity-50"
                                    >
                                      {saving ? "Saving..." : "Save"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-ink-500 mt-2">No tasks here.</p>
                      )}
                    </div>
                  </div>
                </div>
            </div>
          </motion.section>

          {chatOpen && googleConnected ? (
            <motion.section
              className="glass rounded-2xl p-4 flex flex-col h-[260px]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-ink-600">AI Assistant</p>
                <button
                  onClick={() => setChatOpen(false)}
                  className="text-xs text-ink-600 hover:text-ink-900"
                >
                  Minimize
                </button>
              </div>
              <div className="mb-2">
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="w-full rounded-lg bg-ink-900/5 px-3 py-2 text-xs"
                >
                  {aiTools.filter((tool) => configuredTools.includes(tool.id)).length ? (
                    aiTools
                      .filter((tool) => configuredTools.includes(tool.id))
                      .map((tool) => (
                        <option key={tool.id} value={tool.id}>
                          {tool.name}
                        </option>
                      ))
                  ) : (
                    <option value="" disabled>
                      Add an API key in Settings
                    </option>
                  )}
                </select>
              </div>
              <div className="flex-1 overflow-auto pr-2 space-y-2">
                {chatHistory.length === 0 ? (
                  <p className="text-xs text-ink-500">Ask something to get started.</p>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div
                      key={`${msg.role}-${idx}`}
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "ml-auto bg-accent-500/30 text-ink-900"
                          : "mr-auto bg-ink-900/5 text-ink-700"
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))
                )}
                {aiTyping ? (
                  <div className="mr-auto max-w-[60%] rounded-2xl bg-ink-900/5 px-3 py-2 text-xs text-ink-600">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-500 animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-500 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-500 animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  placeholder="Ask TaskFlow..."
                  className="flex-1 rounded-lg bg-ink-900/5 px-3 py-2 text-sm"
                />
                <button onClick={sendChat} className="glass px-4 rounded-lg">
                  Send
                </button>
              </div>
            </motion.section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function toDateKey(date: Date | null | undefined) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTaskDateKey(due?: string) {
  if (!due) return null;
  if (due.length >= 10) {
    const isoDate = due.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  }
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return null;
  return toDateKey(date);
}

function isToday(due?: string) {
  if (!due) return false;
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return false;
  return toDateKey(date) === toDateKey(new Date());
}

function isBeforeToday(due?: string) {
  if (!due) return false;
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return false;
  return toDateKey(date) < toDateKey(new Date());
}

function isAfterToday(due?: string) {
  if (!due) return false;
  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return false;
  return toDateKey(date) > toDateKey(new Date());
}

function CalendarView({
  month,
  selected,
  onSelect,
  onChangeMonth,
  tasks
}: {
  month: Date;
  selected: Date;
  onSelect: (value: Date) => void;
  onChangeMonth: (value: Date) => void;
  tasks: Task[];
}) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const startOffset = start.getDay();
  const days = [];
  for (let i = 0; i < startOffset; i += 1) days.push(null);
  for (let day = 1; day <= end.getDate(); day += 1) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  const indicators = tasks.reduce<Record<string, { missed: number; today: number; upcoming: number }>>(
    (acc, task) => {
      const key = toTaskDateKey(task.due);
      if (!key || task.completed) return acc;
      if (!acc[key]) acc[key] = { missed: 0, today: 0, upcoming: 0 };
      if (isBeforeToday(task.due)) acc[key].missed += 1;
      else if (isToday(task.due)) acc[key].today += 1;
      else if (isAfterToday(task.due)) acc[key].upcoming += 1;
      return acc;
    },
    {}
  );

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Calendar</p>
          <p className="text-lg font-semibold">
            {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              onChangeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            className="glass w-9 h-9 rounded-full text-xs"
          >
            ◀
          </button>
          <button
            onClick={() =>
              onChangeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            className="glass w-9 h-9 rounded-full text-xs"
          >
            ▶
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-[10px] uppercase text-ink-400">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;
          const key = toDateKey(date);
          const isSelected = toDateKey(selected) === key;
          const indicator = indicators[key];
          const glow =
            indicator?.missed
              ? "ring-2 ring-sunset-500/50"
              : indicator?.today
                ? "ring-2 ring-accent-500/50"
                : indicator?.upcoming
                  ? "ring-2 ring-ink-900/10"
                  : "";
          return (
            <button
              key={key}
              onClick={() => onSelect(date)}
              className={`h-10 rounded-2xl text-sm font-semibold ${glow} ${
                isSelected ? "bg-accent-500/70 text-ink-900" : "bg-white/70 text-ink-700"
              }`}
            >
              <div className="flex flex-col items-center leading-none">
                <span>{date.getDate()}</span>
                {indicator?.missed ? (
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sunset-500" />
                ) : indicator?.today ? (
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent-500" />
                ) : indicator?.upcoming ? (
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-ink-900/40" />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
