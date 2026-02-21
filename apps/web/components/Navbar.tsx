"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

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

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-6xl px-6 pt-4">
        <div className="glass rounded-full px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-semibold">
              TaskFlow
            </Link>
            <Link
              href="/"
              className={`text-xs ${pathname === "/" ? "text-white" : "text-white/60"}`}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className={`text-xs ${
                pathname === "/settings" ? "text-white" : "text-white/60"
              }`}
            >
              Settings
            </Link>
            <Link
              href="/check"
              className={`text-xs ${pathname === "/check" ? "text-white" : "text-white/60"}`}
            >
              Check
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {!authed ? (
              <Link href="/login" className="text-xs text-white/70 hover:text-white">
                Login
              </Link>
            ) : (
              <button onClick={logout} className="text-xs text-white/70 hover:text-white">
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="h-16" />
    </div>
  );
}
