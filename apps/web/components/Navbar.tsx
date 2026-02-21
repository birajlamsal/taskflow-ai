"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { ThemeToggle } from "./ThemeToggle";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthed(Boolean(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function toggleChat() {
    window.dispatchEvent(new CustomEvent("taskflow:toggle-chat"));
  }

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed inset-x-0 top-0 z-50 transition-all duration-500 py-4"
    >
      <div className={`mx-auto max-w-6xl px-6 transition-all duration-500 ${scrolled ? "max-w-4xl" : "max-w-6xl"}`}>
        <div className="glass rounded-full px-8 py-3 flex items-center justify-center gap-12 border-white/20 shadow-xl">
          <div className="flex items-center gap-10">
            <Link href="/" className="group flex items-center gap-2">
              <div className="w-8 h-8 bg-ink-900 rounded-lg flex items-center justify-center transition-transform group-hover:rotate-12">
                <div className="w-4 h-4 bg-accent-500 rounded-sm animate-pulse" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-ink-900">
                TaskFlow<span className="text-accent-600">.</span>
              </span>
            </Link>

            {authed && (
              <div className="hidden md:flex items-center gap-4">
                {[
                  { name: "Dashboard", href: "/dashboard" },
                  { name: "Settings", href: "/settings" },
                  { name: "Check", href: "/check" },
                ].map((item) => {
                  const isActive = pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative font-medium transition-all duration-300 px-4 py-2 rounded-full flex flex-col items-center group ${isActive
                        ? "text-ink-900 scale-105"
                        : "text-ink-500 hover:text-accent-500 dark:hover:text-accent-400"
                        }`}
                    >
                      <span className={`transition-all duration-300 ${isActive ? "text-sm font-bold" : "text-xs group-hover:scale-110"}`}>
                        {item.name}
                      </span>

                      {isActive && (
                        <>
                          <motion.div
                            layoutId="nav-underline"
                            className="absolute -bottom-1 left-3 right-3 h-0.5 bg-accent-500 rounded-full shadow-[0_0_12px_rgba(43,185,173,0.8)]"
                          />
                          <motion.div
                            layoutId="nav-glow"
                            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-4 bg-accent-500/20 blur-xl rounded-full"
                          />
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <ThemeToggle />
            {authed && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleChat}
                className="text-xs font-semibold text-ink-600 hover:text-ink-900 transition-colors"
              >
                Assistant
              </motion.button>
            )}
            <AnimatePresence mode="wait">
              {!authed ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Link href="/login" className="primary-button glow !px-5 !py-1.5 text-xs">
                    Login
                  </Link>
                </motion.div>
              ) : (
                <motion.button
                  key="logout"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={logout}
                  className="text-xs font-semibold text-ink-600 hover:text-red-500 transition-colors"
                >
                  Logout
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
