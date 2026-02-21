"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const GREETINGS = [
  { text: "Hello", lang: "English" },
  { text: "नमस्ते", lang: "Nepali" },
  { text: "Hola", lang: "Spanish" },
  { text: "Bonjour", lang: "French" },
  { text: "Ciao", lang: "Italian" },
  { text: "こんにちは", lang: "Japanese" },
  { text: "안녕하세요", lang: "Korean" },
  { text: "Habari", lang: "Swahili" },
];

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
  const [savingTaskIds, setSavingTaskIds] = useState<Record<string, boolean>>({});
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [taskStatusEdits, setTaskStatusEdits] = useState<
    Record<string, "open" | "completed">
  >({});
  const [linkedProviderToken, setLinkedProviderToken] = useState<string | null>(null);
  const [greetingIndex, setGreetingIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setGreetingIndex((prev: number) => (prev + 1) % GREETINGS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const session = data.session;
      setToken(session?.access_token ?? null);
      const providerToken = (session as any)?.provider_token as string | undefined;
      const providerRefresh = (session as any)?.provider_refresh_token as string | undefined;
      if (session?.access_token && providerToken && providerToken !== linkedProviderToken) {
        fetch(`${API_URL}/google/link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            access_token: providerToken,
            refresh_token: providerRefresh
          })
        }).finally(() => {
          setLinkedProviderToken(providerToken);
        });
      }
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token ?? null);
      const providerToken = (session as any)?.provider_token as string | undefined;
      const providerRefresh = (session as any)?.provider_refresh_token as string | undefined;
      if (session?.access_token && providerToken && providerToken !== linkedProviderToken) {
        fetch(`${API_URL}/google/link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            access_token: providerToken,
            refresh_token: providerRefresh
          })
        }).finally(() => {
          setLinkedProviderToken(providerToken);
        });
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [linkedProviderToken]);

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
      currentLists.map(async (list: TaskList) => {
        const res = await fetch(`${API_URL}/tasklists/${list.id}/tasks`, {
          headers: { Authorization: `Bearer ${t}` }
        });
        const data = await res.json();
        return Array.isArray(data) ? (data as Task[]) : [];
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

  useEffect(() => {
    function refresh() {
      if (token) {
        loadLists(token);
      }
    }
    window.addEventListener("taskflow:refresh-tasks", refresh);
    return () => window.removeEventListener("taskflow:refresh-tasks", refresh);
  }, [token]);

  async function saveTaskStatus(taskId: string, listId: string, status: "open" | "completed") {
    if (!token) return;
    setSavingTaskIds((prev: Record<string, boolean>) => ({ ...prev, [taskId]: true }));
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
      setSavingTaskIds((prev: Record<string, boolean>) => ({ ...prev, [taskId]: false }));
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
    <div className="min-h-screen px-6 pb-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex items-center justify-between"
        >
          <div>
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs uppercase tracking-[0.4em] text-accent-600 font-bold mb-2"
            >
              TaskFlow AI
            </motion.p>
            <h1 className="text-5xl font-display font-bold text-ink-900 tracking-tight flex items-center gap-3">
              <div className="relative inline-flex items-center justify-center min-w-[200px] h-16">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={GREETINGS[greetingIndex].text}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.8, ease: "circOut" }}
                    className="absolute"
                  >
                    {GREETINGS[greetingIndex].text}
                  </motion.span>
                </AnimatePresence>
              </div>
              <span className="text-gradient font-black">{displayName ? `, ${displayName}` : ""}</span>.
            </h1>
            <p className="text-lg text-ink-500 mt-2 font-medium">Flow through tasks with intelligence.</p>
          </div>
        </motion.header>

        <div className="relative space-y-12">
          <motion.section
            className="glass rounded-[2.5rem] p-8 space-y-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="space-y-4">

              {googleConnected ? (
                <div className="glass rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
                        Overview
                      </p>
                      <p className="text-lg font-semibold">Task summary</p>
                      <p className="text-xs text-ink-500">
                        {allTasks.length} total • {completedCount} done
                      </p>
                    </div>
                    <motion.button
                      onClick={async () => {
                        if (syncing) return;
                        setSyncing(true);
                        await loadAllTasks(lists, token);
                        setSyncing(false);
                      }}
                      animate={syncing ? {
                        x: [0, -2, 2, -1.5, 1.5, -1, 1, 0],
                        transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
                      } : { x: 0 }}
                      className="relative overflow-hidden glass px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                      style={{
                        boxShadow: syncing
                          ? "0 0 0 2px rgba(76,224,210,0.3), 0 0 16px rgba(76,224,210,0.4), 0 0 32px rgba(76,224,210,0.2)"
                          : undefined,
                      }}
                    >
                      {/* shimmer sweep */}
                      {syncing && (
                        <motion.span
                          className="absolute inset-0 rounded-full pointer-events-none"
                          style={{
                            background:
                              "linear-gradient(105deg, transparent 20%, rgba(76,224,210,0.55) 50%, transparent 80%)",
                            backgroundSize: "200% 100%",
                          }}
                          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                        />
                      )}
                      {/* pulsing outer glow ring */}
                      {syncing && (
                        <motion.span
                          className="absolute -inset-[3px] rounded-full pointer-events-none"
                          style={{ border: "1.5px solid rgba(76,224,210,0.6)", borderRadius: "9999px" }}
                          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.06, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                      <span className="relative z-10">{syncing ? "Syncing…" : "Sync"}</span>
                    </motion.button>
                  </div>
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
                <div className="glass-card rounded-[2rem] p-6">
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
                        className={`rounded-full px-4 py-2 ${calendarScope === "missed"
                          ? "bg-sunset-500/80 text-ink-900"
                          : "bg-white/70 dark:bg-white/5 text-ink-700 dark:text-ink-500"
                          }`}
                      >
                        Missed
                      </button>
                      <button
                        onClick={() => {
                          setCalendarScope("today");
                          setSelectedDate(null);
                        }}
                        className={`rounded-full px-4 py-2 ${calendarScope === "today"
                          ? "bg-accent-500/80 text-ink-900"
                          : "bg-white/70 dark:bg-white/5 text-ink-700 dark:text-ink-500"
                          }`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => {
                          setCalendarScope("upcoming");
                          setSelectedDate(null);
                        }}
                        className={`rounded-full px-4 py-2 ${calendarScope === "upcoming"
                          ? "bg-accent-500/10 dark:bg-accent-500/40 text-ink-900"
                          : "bg-white/70 dark:bg-white/5 text-ink-700 dark:text-ink-500"
                          }`}
                      >
                        Upcoming
                      </button>
                      <button
                        onClick={() => {
                          setCalendarScope("completed");
                          setSelectedDate(null);
                        }}
                        className={`rounded-full px-4 py-2 ${calendarScope === "completed"
                          ? "bg-emerald-500/10 dark:bg-emerald-500/40 text-ink-900"
                          : "bg-white/70 dark:bg-white/5 text-ink-700 dark:text-ink-500"
                          }`}
                      >
                        Completed
                      </button>
                      <button
                        onClick={() => {
                          setCalendarScope("selected");
                          setSelectedDate(new Date());
                        }}
                        className={`rounded-full px-4 py-2 ${calendarScope === "selected"
                          ? "bg-accent-500/10 dark:bg-accent-500/40 text-ink-900"
                          : "bg-white/70 dark:bg-white/5 text-ink-700 dark:text-ink-500"
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
                      <motion.div
                        layout
                        className="mt-3 space-y-2"
                      >
                        <AnimatePresence mode="popLayout">
                          {tasksForSelectedDate.map((task, index) => {
                            const currentStatus = task.completed ? "completed" : "open";
                            const selectedStatus =
                              taskStatusEdits[task.id] ?? currentStatus;
                            const dirty = selectedStatus !== currentStatus;
                            const saving = Boolean(savingTaskIds[task.id]);
                            return (
                              <motion.div
                                layout
                                whileHover={{ scale: 1.01 }}
                                key={task.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                className="glass-card rounded-xl px-4 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium">{task.title}</p>
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={selectedStatus}
                                      onChange={(e) =>
                                        setTaskStatusEdits((prev: Record<string, "open" | "completed">) => ({
                                          ...prev,
                                          [task.id]: e.target.value as
                                            | "open"
                                            | "completed"
                                        }))
                                      }
                                      className="rounded-lg bg-ink-900/5 px-3 py-2 text-xs transition-colors hover:bg-ink-900/10 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                                    >
                                      <option value="open">To Do</option>
                                      <option value="completed">Done</option>
                                    </select>
                                    <motion.button
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() =>
                                        saveTaskStatus(task.id, task.listId, selectedStatus)
                                      }
                                      disabled={!dirty || saving}
                                      className="primary-button !px-3 !py-2 rounded-lg text-xs disabled:opacity-50 !bg-accent-500/10 !text-accent-700 hover:!bg-accent-500/20"
                                    >
                                      {saving ? "Saving..." : "Save"}
                                    </motion.button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </motion.div>
                    ) : (
                      <p className="text-xs text-ink-500 mt-2">No tasks here.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

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
  const today = new Date();
  const todayKey = toDateKey(today);
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const startOffset = start.getDay();
  const days: (Date | null)[] = [];
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent-600 font-semibold mb-0.5">
            {month.toLocaleString(undefined, { year: "numeric" })}
          </p>
          <p className="text-xl font-display font-bold text-ink-900 leading-none">
            {month.toLocaleString(undefined, { month: "long" })}
          </p>
        </div>
        <div className="flex gap-1">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-ink-900/5 dark:hover:bg-white/10 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-ink-900/5 dark:hover:bg-white/10 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-ink-400 tracking-widest uppercase py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;
          const key = toDateKey(date);
          const isSelected = toDateKey(selected) === key;
          const isTodayDate = key === todayKey;
          const indicator = indicators[key];
          const dotColor = indicator?.missed
            ? "bg-sunset-500"
            : indicator?.today
              ? "bg-accent-500"
              : indicator?.upcoming
                ? "bg-ink-400/50"
                : null;

          return (
            <div key={key} className="flex flex-col items-center gap-[3px] py-0.5">
              <motion.button
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onSelect(date)}
                className={`
                  relative w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center transition-all duration-200
                  ${isSelected
                    ? "bg-accent-500 text-ink-900 font-bold shadow-[0_0_12px_rgba(76,224,210,0.35)]"
                    : isTodayDate
                      ? "text-accent-600 font-bold"
                      : "text-ink-700 dark:text-ink-400 hover:bg-ink-900/5 dark:hover:bg-white/8"
                  }
                `}
              >
                {date.getDate()}
                {/* Today underline (when not selected) */}
                {isTodayDate && !isSelected && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-accent-500" />
                )}
              </motion.button>
              {/* Task dot */}
              {dotColor ? (
                <span className={`w-1 h-1 rounded-full ${dotColor} ${isSelected ? "opacity-0" : ""}`} />
              ) : (
                <span className="w-1 h-1" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
