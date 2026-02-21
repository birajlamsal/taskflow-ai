"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AICopilot() {
    const [token, setToken] = useState<string | null>(null);
    const [chat, setChat] = useState("");
    const [chatHistory, setChatHistory] = useState<
        Array<{ role: "user" | "assistant"; text: string }>
    >([]);
    const [aiTools, setAiTools] = useState<Array<{ id: string; name: string }>>([]);
    const [configuredTools, setConfiguredTools] = useState<string[]>([]);
    const [selectedTool, setSelectedTool] = useState("openai");
    const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
    const [chatOpen, setChatOpen] = useState(false);
    const [aiTyping, setAiTyping] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setToken(data.session?.access_token ?? null);
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setToken(session?.access_token ?? null);
        });
        return () => listener.subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!token) return;
        const loadConfig = () => {
            fetch(`${API_URL}/ai/tools`)
                .then(async (res) => {
                    const data = await res.json();
                    setAiTools(Array.isArray(data.tools) ? data.tools : []);
                })
                .catch(() => setAiTools([]));

            fetch(`${API_URL}/ai/keys`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(async (res) => {
                    if (!res.ok) {
                        setConfiguredTools([]);
                        return;
                    }
                    const data = (await res.json()) as { tools?: string[] };
                    setConfiguredTools(Array.isArray(data.tools) ? data.tools : []);
                })
                .catch(() => setConfiguredTools([]));

            fetch(`${API_URL}/google/status`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(async (res) => {
                    if (!res.ok) {
                        setGoogleConnected(false);
                        return;
                    }
                    const data = (await res.json()) as { connected?: boolean };
                    setGoogleConnected(Boolean(data.connected));
                })
                .catch(() => setGoogleConnected(false));
        };

        loadConfig();
        const handler = () => loadConfig();
        window.addEventListener("taskflow:ai-keys-updated", handler);
        return () => window.removeEventListener("taskflow:ai-keys-updated", handler);
    }, [token]);

    useEffect(() => {
        if (!configuredTools.length) return;
        if (!configuredTools.includes(selectedTool)) {
            setSelectedTool(configuredTools[0]);
        }
    }, [configuredTools, selectedTool]);

    useEffect(() => {
        function handleToggle() {
            setChatOpen((prev) => !prev);
        }
        window.addEventListener("taskflow:toggle-chat", handleToggle);
        return () => window.removeEventListener("taskflow:toggle-chat", handleToggle);
    }, []);

    async function sendChat() {
        if (!token || !chat.trim()) return;
        if (!configuredTools.length || !configuredTools.includes(selectedTool)) {
            setChatHistory((prev) => [
                ...prev,
                { role: "assistant", text: "Add an AI API key in Settings to use chat." }
            ]);
            return;
        }
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
            if (data.message) {
                setChatHistory((prev) => [...prev, { role: "assistant", text: data.message }]);
            }
            // If the AI modified tasks, notify the UI to refresh
            if (Array.isArray(data.tasks)) {
                window.dispatchEvent(new CustomEvent("taskflow:refresh-tasks"));
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

    if (!token) return null;

    return (
        <AnimatePresence>
            {chatOpen ? (
                <motion.section
                    key="chat-sidebar"
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", y: 50, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed top-0 right-0 h-screen w-full md:w-[280px] lg:w-[320px] z-[100] glass flex flex-col border-l border-white/20 shadow-[-20px_0_50px_rgba(0,0,0,0.1)] rounded-none p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-accent-600 font-bold mb-1">Copilot</p>
                            <h2 className="text-xl font-display font-bold text-ink-900 dark:text-ink-100">
                                AI Assistant
                            </h2>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setChatOpen(false)}
                            className="w-10 h-10 glass rounded-full flex items-center justify-center text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white shadow-sm"
                        >
                            ✕
                        </motion.button>
                    </div>

                    <div className="mb-4">
                        <p className="text-[10px] uppercase font-bold text-ink-400 mb-2 tracking-widest pl-1">Configuration</p>
                        <select
                            value={selectedTool}
                            onChange={(e) => setSelectedTool(e.target.value)}
                            className="w-full rounded-2xl bg-white/50 dark:bg-white/5 border border-white/20 px-4 py-3 text-sm font-medium text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-accent-500/30 transition-all"
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
                        {googleConnected === false ? (
                            <p className="mt-2 text-[10px] text-ink-400">
                                Google is not connected. Task actions may fail, but chat still works.
                            </p>
                        ) : null}
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 custom-scrollbar">
                        {chatHistory.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-40 text-center p-8">
                                <div className="w-16 h-16 bg-accent-500/20 rounded-full flex items-center justify-center mb-4">
                                    <div className="w-8 h-8 bg-accent-500 rounded-lg animate-pulse" />
                                </div>
                                <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                                    How can I help you today?
                                </p>
                            </div>
                        ) : (
                            chatHistory.map((msg, idx) => (
                                <motion.div
                                    key={`${msg.role}-${idx}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`max-w-[90%] rounded-[1.5rem] px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                                        ? "ml-auto bg-accent-500/80 text-ink-900 dark:text-white shadow-lift"
                                        : "mr-auto glass-card text-ink-700 dark:text-ink-200 shadow-sm"
                                        }`}
                                >
                                    {msg.text}
                                </motion.div>
                            ))
                        )}
                        {aiTyping ? (
                            <div className="mr-auto glass-card rounded-[1.5rem] px-4 py-3 shadow-sm">
                                <span className="inline-flex gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-bounce" />
                                    <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-bounce [animation-delay:150ms]" />
                                    <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-bounce [animation-delay:300ms]" />
                                </span>
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-6 space-y-3">
                        <div className="flex gap-1.5 p-1 glass rounded-2xl border-white/40 shadow-inner">
                            <input
                                value={chat}
                                onChange={(e) => setChat(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                                placeholder="Ask anything..."
                                className="flex-1 min-w-0 bg-transparent px-3 py-3 text-sm font-medium text-ink-900 dark:text-ink-100 focus:outline-none placeholder:text-ink-400 dark:placeholder:text-ink-500"
                            />
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={sendChat}
                                className="bg-ink-900 text-white dark:bg-white/80 dark:text-ink-900 px-4 rounded-xl text-sm font-bold shadow-glow hover:bg-ink-800 dark:hover:bg-white transition-colors shrink-0"
                            >
                                Send
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setChatOpen(false)}
                                className="glass px-2.5 rounded-xl text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white transition-colors flex items-center justify-center shrink-0"
                                title="Minimize Chat"
                            >
                                ✕
                            </motion.button>
                        </div>
                        <p className="text-[10px] text-center text-ink-400 font-medium tracking-tight">AI can make mistakes. Verify important info.</p>
                    </div>
                </motion.section>
            ) : (
                <motion.button
                    key="chat-handle"
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    whileHover={{ x: -4, scaleY: 1.01 }}
                    onClick={() => setChatOpen(true)}
                    className="fixed top-1/2 right-0 -translate-y-1/2 z-[100] glass h-[50vh] px-1.5 rounded-l-full border border-white/30 shadow-2xl transition-all hover:bg-white/60 group overflow-hidden flex flex-col items-center justify-center"
                >
                    <div className="flex flex-col items-center gap-12 relative w-full h-full py-12">
                        <div className="w-1 h-8 bg-accent-500 rounded-full animate-pulse opacity-50" />
                        <span
                            className="text-[10px] font-black uppercase tracking-[0.5em] text-black dark:text-yellow-400 transition-colors whitespace-nowrap"
                            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                        >
                            AI ASSISTANT
                        </span>
                        <div className="w-1 h-8 bg-accent-500 rounded-full animate-pulse opacity-50" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-500/10 to-transparent pointer-events-none" />
                    </div>
                </motion.button>
            )}
        </AnimatePresence>
    );
}
