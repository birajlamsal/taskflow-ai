"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    motion,
    useScroll,
    useInView,
    useSpring,
    AnimatePresence,
    animate,
} from "framer-motion";

// ── Helpers ───────────────────────────────────────────────────────────────────
function useCounter(target: number, inView: boolean) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!inView) return;
        const controls = animate(0, target, {
            duration: 2,
            ease: [0.16, 1, 0.3, 1],
            onUpdate(v) { setCount(Math.round(v)); },
        });
        return controls.stop;
    }, [inView, target]);
    return count;
}

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12 } },
};

const slideIn = (dir: "left" | "right") => ({
    hidden: { opacity: 0, x: dir === "left" ? -60 : 60 },
    show: { opacity: 1, x: 0, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
});

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: "-100px" });
    return (
        <motion.section
            id={id}
            ref={ref}
            variants={staggerContainer}
            initial="hidden"
            animate={inView ? "show" : "hidden"}
            className={className}
        >
            {children}
        </motion.section>
    );
}

// ── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({
    icon, title, description, accent, delay = 0,
}: {
    icon: string; title: string; description: string; accent: string; delay?: number;
}) {
    const ref = useRef(null);
    const isHovered = useRef(false);
    return (
        <motion.div
            ref={ref}
            variants={fadeUp}
            custom={delay}
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="glass-card rounded-2xl p-6 flex flex-col gap-4 cursor-default"
        >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${accent}`}>
                {icon}
            </div>
            <h3 className="text-lg font-bold text-ink-900">{title}</h3>
            <p className="text-sm text-ink-500 leading-relaxed">{description}</p>
        </motion.div>
    );
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    const count = useCounter(value, inView);
    return (
        <div ref={ref} className="text-center">
            <p className="text-4xl md:text-5xl font-display font-bold text-gradient">
                {count}{suffix}
            </p>
            <p className="text-sm text-ink-500 mt-1">{label}</p>
        </div>
    );
}

// ── Floating Task Preview ─────────────────────────────────────────────────────
const DEMO_TASKS = [
    { title: "Design system update", tag: "Work", done: true, time: "9:00 AM" },
    { title: "Review pull requests", tag: "Dev", done: false, time: "11:00 AM" },
    { title: "Lunch with team", tag: "Personal", done: false, time: "1:00 PM" },
    { title: "Ship v2.1 release", tag: "Work", done: false, time: "4:00 PM" },
];

const TAG_COLORS: Record<string, string> = {
    Work: "bg-accent-500/20 text-accent-600",
    Dev: "bg-sunset-500/20 text-sunset-600",
    Personal: "bg-purple-500/20 text-purple-500",
};

function DashboardPreview() {
    const [doneIndex, setDoneIndex] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setDoneIndex((i: number) => (i + 1) % DEMO_TASKS.length), 2200);
        return () => clearInterval(id);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 60, rotateX: 20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.6, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ perspective: 1000 }}
            className="w-full max-w-md mx-auto"
        >
            <div className="glass-card rounded-3xl p-5 shadow-2xl">
                {/* mini navbar */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-400/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                    <div className="w-3 h-3 rounded-full bg-green-400/70" />
                    <div className="flex-1 mx-3 h-5 rounded-full bg-ink-900/5" />
                </div>
                {/* header */}
                <div className="mb-3">
                    <p className="text-xs text-ink-400 uppercase tracking-widest">Today</p>
                    <p className="text-lg font-bold text-ink-900 dark:text-white font-display">Focus Mode</p>
                </div>
                {/* tasks */}
                <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                        {DEMO_TASKS.map((task, i) => {
                            const done = i < doneIndex;
                            return (
                                <motion.div
                                    key={task.title}
                                    layout
                                    initial={{ opacity: 0, x: -16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500 ${done ? "bg-accent-500/5 opacity-60" : "bg-ink-900/5"
                                        }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-500 ${done ? "border-accent-500 bg-accent-500" : "border-ink-300"
                                            }`}
                                    >
                                        {done && <span className="text-white text-xs">✓</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate transition-all duration-500 ${done ? "line-through text-ink-400" : "text-ink-900 dark:text-white"}`}>
                                            {task.title}
                                        </p>
                                        <p className="text-xs text-ink-400">{task.time}</p>
                                    </div>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TAG_COLORS[task.tag] ?? "bg-ink-900/10 text-ink-500"}`}>
                                        {task.tag}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}

// ── How It Works Row ──────────────────────────────────────────────────────────
function HowItWorksRow({
    num, title, body, preview, isEven,
}: {
    num: string; title: string; body: string; preview: React.ReactNode; isEven: boolean;
}) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: "-80px" });
    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={inView ? "show" : "hidden"}
            variants={staggerContainer}
            className={`flex flex-col ${isEven ? "md:flex-row" : "md:flex-row-reverse"} gap-12 items-center`}
        >
            <motion.div variants={slideIn(isEven ? "left" : "right")} className="flex-1 space-y-4">
                <span className="text-6xl font-display font-bold text-gradient opacity-40">{num}</span>
                <h3 className="text-3xl font-display font-bold text-ink-900">{title}</h3>
                <p className="text-ink-500 leading-relaxed">{body}</p>
            </motion.div>
            <motion.div variants={slideIn(isEven ? "right" : "left")} className="flex-1">
                {preview}
            </motion.div>
        </motion.div>
    );
}

// ── Testimonial ───────────────────────────────────────────────────────────────
const TESTIMONIALS = [
    { name: "Sarah Chen", role: "Product Manager @ Stripe", quote: "TaskFlow AI completely changed how I structure my day. The AI suggestions are scarily accurate.", avatar: "SC" },
    { name: "Marcus Riley", role: "Lead Engineer @ Vercel", quote: "Finally a task app that talks back. The AI copilot understands context in a way other tools simply don't.", avatar: "MR" },
    { name: "Aisha Patel", role: "Founder @ Luminary", quote: "Went from 50+ sticky notes to one clean dashboard overnight. My team calls it witchcraft.", avatar: "AP" },
];

function TestimonialCard({ name, role, quote, avatar, index }: typeof TESTIMONIALS[0] & { index: number }) {
    return (
        <motion.div
            variants={fadeUp}
            custom={index}
            className="glass-card rounded-2xl p-6 flex flex-col gap-4"
        >
            <p className="text-sm text-ink-600 leading-relaxed italic">"{quote}"</p>
            <div className="flex items-center gap-3 mt-auto">
                <div className="w-9 h-9 rounded-full bg-accent-500/20 flex items-center justify-center text-xs font-bold text-accent-600">
                    {avatar}
                </div>
                <div>
                    <p className="text-sm font-semibold text-ink-900">{name}</p>
                    <p className="text-xs text-ink-400">{role}</p>
                </div>
            </div>
        </motion.div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Test1Page() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

    return (
        <div className="relative w-full overflow-x-hidden">
            {/* ── Progress bar ─────────────────────────────────────────────────── */}
            <motion.div
                style={{ scaleX }}
                className="fixed top-0 left-0 right-0 h-0.5 bg-accent-500 origin-left z-[100] shadow-[0_0_12px_rgba(76,224,210,0.8)]"
            />

            {/* ════════════════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════════════════ */}
            <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden pt-16">
                {/* ambient blobs */}
                <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent-500 blur-[120px] pointer-events-none"
                />
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-sunset-500 blur-[100px] pointer-events-none"
                />

                {/* badge */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-8"
                >
                    <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
                    <span className="text-xs font-semibold text-ink-600 uppercase tracking-widest">Powered by AI</span>
                </motion.div>

                {/* headline */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="space-y-4 max-w-4xl"
                >
                    {["Your tasks.", "Your AI.", "One flow."].map((line, i) => (
                        <motion.h1
                            key={i}
                            variants={fadeUp}
                            custom={i}
                            className={`text-6xl md:text-8xl font-display font-bold leading-none tracking-tight ${i === 1 ? "text-gradient" : "text-ink-900"
                                }`}
                        >
                            {line}
                        </motion.h1>
                    ))}
                </motion.div>

                {/* sub */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-6 max-w-xl text-lg text-ink-500 leading-relaxed"
                >
                    TaskFlow AI understands your schedule, priorities and working style —
                    then builds the perfect day, automatically.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-wrap items-center justify-center gap-4 mt-10"
                >
                    <Link href="/login">
                        <motion.span
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.97 }}
                            className="inline-flex px-8 py-3.5 text-sm font-semibold rounded-full bg-accent-500 text-ink-900 shadow-[0_0_24px_rgba(76,224,210,0.4)] hover:bg-accent-600 transition-all cursor-pointer"
                        >
                            Start for free →
                        </motion.span>
                    </Link>
                    <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                        className="glass rounded-full px-7 py-3.5 text-sm font-semibold text-ink-700 hover:text-ink-900 transition-colors"
                    >
                        See how it works
                    </motion.button>
                </motion.div>

                {/* dashboard preview */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.1, duration: 0.8 }}
                    className="mt-20 w-full max-w-lg"
                >
                    <DashboardPreview />
                </motion.div>

                {/* scroll hint */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 0.6 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                >
                    <span className="text-xs text-ink-400">Scroll</span>
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                        className="w-0.5 h-8 bg-gradient-to-b from-ink-400 to-transparent rounded-full"
                    />
                </motion.div>
            </section>

            {/* ════════════════════════════════════════════════════════════════════
          STATS
      ════════════════════════════════════════════════════════════════════ */}
            <Section className="py-24 px-6 mt-[3px]">
                <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12">
                    {[
                        { value: 50000, suffix: "+", label: "Tasks organized daily" },
                        { value: 98, suffix: "%", label: "User satisfaction" },
                        { value: 12, suffix: "×", label: "Faster planning" },
                        { value: 5, suffix: " AI models", label: "Available to power you" },
                    ].map((s) => (
                        <motion.div key={s.label} variants={fadeUp}>
                            <StatCard {...s} />
                        </motion.div>
                    ))}
                </div>
            </Section>

            {/* ════════════════════════════════════════════════════════════════════
          FEATURES
      ════════════════════════════════════════════════════════════════════ */}
            <Section id="features" className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div variants={fadeUp} className="text-center mb-16">
                        <p className="text-xs uppercase tracking-[0.3em] text-accent-600 font-bold mb-3">Features</p>
                        <h2 className="text-4xl md:text-5xl font-display font-bold text-ink-900 leading-tight">
                            Everything you need.<br />
                            <span className="text-gradient">Nothing you don't.</span>
                        </h2>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { icon: "🤖", accent: "bg-accent-500/15", title: "AI Copilot", description: "Ask your assistant to create, update, or re-schedule tasks using plain English. Like having a personal EA available 24/7." },
                            { icon: "📅", accent: "bg-sunset-500/15", title: "Smart Calendar", description: "Connect Google Tasks and watch your day auto-organize around your deadlines, energy levels and priorities." },
                            { icon: "⚡", accent: "bg-purple-500/15", title: "Focus Mode", description: "Eliminate distractions. TaskFlow surfaces only what matters right now — no doom-scrolling your backlog." },
                            { icon: "🔗", accent: "bg-accent-500/15", title: "Deep Integrations", description: "Google Tasks, Notion, and more. All your work lives in one place, automatically kept in sync." },
                            { icon: "🌙", accent: "bg-ink-500/15", title: "OLED Dark Mode", description: "Crafted for late-night deep work sessions. Pure blacks that are easy on your eyes and look stunning." },
                            { icon: "📊", accent: "bg-sunset-500/15", title: "Progress Insights", description: "Weekly reports powered by AI that tell you where your time really went — and how to get it back." },
                        ].map((f, i) => (
                            <FeatureCard key={f.title} {...f} delay={i * 0.08} />
                        ))}
                    </div>
                </div>
            </Section>

            {/* ════════════════════════════════════════════════════════════════════
          HOW IT WORKS  (alternating layout)
      ════════════════════════════════════════════════════════════════════ */}
            <section className="py-24 px-6">
                <div className="max-w-5xl mx-auto space-y-32">
                    <HowItWorksRow num="01" title="Connect your world" isEven={true}
                        body="Link Google Tasks or start fresh. TaskFlow imports everything in under 10 seconds and structures it intelligently."
                        preview={
                            <div className="glass-card rounded-3xl p-6 space-y-3">
                                {["Google Tasks", "Notion", "Apple Reminders"].map((name) => (
                                    <div key={name} className="flex items-center gap-3 glass rounded-xl px-4 py-3">
                                        <div className="w-7 h-7 rounded-lg bg-accent-500/20 flex items-center justify-center text-accent-600 font-bold text-xs">✓</div>
                                        <span className="text-sm font-medium text-ink-900">{name} connected</span>
                                    </div>
                                ))}
                            </div>
                        }
                    />
                    <HowItWorksRow num="02" title="Let AI plan your day" isEven={false}
                        body="Describe what you need in plain English. TaskFlow AI creates tasks, sets priorities and schedules them — instantly."
                        preview={
                            <div className="glass-card rounded-3xl p-6 space-y-4">
                                <div className="glass rounded-2xl px-4 py-3 flex gap-3 items-start">
                                    <span className="text-accent-500 text-lg">💬</span>
                                    <p className="text-sm text-ink-700 italic">&quot;Schedule a design review for tomorrow morning and remind me to prep slides the night before.&quot;</p>
                                </div>
                                <div className="space-y-2 pl-2">
                                    <div className="flex gap-2 items-center"><span className="text-accent-500">✓</span><span className="text-sm text-ink-900">Design Review — Tomorrow 9 AM</span></div>
                                    <div className="flex gap-2 items-center"><span className="text-accent-500">✓</span><span className="text-sm text-ink-900">Prep slides reminder — Today 8 PM</span></div>
                                </div>
                            </div>
                        }
                    />
                    <HowItWorksRow num="03" title="Flow through your tasks" isEven={true}
                        body="Stay in the zone with Focus Mode. One task at a time, animated progress, and AI keeping you on track."
                        preview={
                            <div className="glass-card rounded-3xl p-6">
                                <p className="text-xs text-ink-400 uppercase tracking-widest mb-3">Now focusing on</p>
                                <p className="text-xl font-bold text-ink-900 mb-5">Design system update</p>
                                <div className="h-2 rounded-full bg-ink-900/5 overflow-hidden">
                                    <motion.div
                                        className="h-full bg-accent-500 rounded-full"
                                        initial={{ width: "0%" }}
                                        whileInView={{ width: "68%" }}
                                        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                                        viewport={{ once: true }}
                                    />
                                </div>
                                <p className="text-xs text-ink-400 mt-2 text-right">68% complete</p>
                            </div>
                        }
                    />
                </div>
            </section>

            {/* ════════════════════════════════════════════════════════════════════
          TESTIMONIALS
      ════════════════════════════════════════════════════════════════════ */}
            <Section className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <motion.div variants={fadeUp} className="text-center mb-16">
                        <p className="text-xs uppercase tracking-[0.3em] text-accent-600 font-bold mb-3">Testimonials</p>
                        <h2 className="text-4xl md:text-5xl font-display font-bold text-ink-900">
                            Loved by makers
                        </h2>
                    </motion.div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {TESTIMONIALS.map((t, i) => (
                            <TestimonialCard key={t.name} {...t} index={i} />
                        ))}
                    </div>
                </div>
            </Section>

            {/* ════════════════════════════════════════════════════════════════════
          CTA
      ════════════════════════════════════════════════════════════════════ */}
            <Section className="py-32 px-6">
                <div className="max-w-3xl mx-auto text-center space-y-8 relative">
                    {/* glow */}
                    <motion.div
                        animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.3, 0.15] }}
                        transition={{ duration: 6, repeat: Infinity }}
                        className="absolute inset-0 rounded-full bg-accent-500 blur-[120px] pointer-events-none"
                    />

                    <motion.div variants={fadeUp} className="relative">
                        <p className="text-xs uppercase tracking-[0.3em] text-accent-600 font-bold mb-4">Get started</p>
                        <h2 className="text-5xl md:text-7xl font-display font-bold text-ink-900 leading-tight">
                            Ready to flow?
                        </h2>
                        <p className="text-lg text-ink-500 mt-4">
                            Join thousands of teams who do more — with less stress.
                        </p>
                    </motion.div>

                    <motion.div
                        variants={fadeUp}
                        className="flex flex-wrap items-center justify-center gap-4 relative"
                    >
                        <Link href="/login">
                            <motion.span
                                whileHover={{ scale: 1.07 }}
                                whileTap={{ scale: 0.96 }}
                                className="inline-flex px-10 py-4 text-base font-semibold rounded-full bg-accent-500 text-ink-900 shadow-[0_0_32px_rgba(76,224,210,0.5)] hover:bg-accent-600 transition-all cursor-pointer"
                            >
                                Start free — no credit card
                            </motion.span>
                        </Link>
                    </motion.div>

                    <motion.p variants={fadeUp} className="text-xs text-ink-400">
                        Works with Google Tasks • 5 AI models • Always-on dark mode
                    </motion.p>
                </div>
            </Section>
        </div>
    );
}
