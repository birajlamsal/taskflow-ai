"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) return <div className="w-10 h-10" />;

    const isDark = theme === "dark";

    return (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative w-10 h-10 flex items-center justify-center rounded-full glass overflow-hidden"
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={theme}
                    initial={{ y: 20, opacity: 0, rotate: -90 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: -20, opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-center"
                >
                    {isDark ? (
                        <Sun className="w-5 h-5 text-accent-500 fill-accent-500" />
                    ) : (
                        <Moon className="w-5 h-5 text-ink-900 fill-ink-900" />
                    )}
                </motion.div>
            </AnimatePresence>
            <div className="absolute inset-0 bg-accent-500/10 opacity-0 hover:opacity-100 transition-opacity" />
        </motion.button>
    );
}
