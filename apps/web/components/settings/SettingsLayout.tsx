"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const SettingsAuthContext = createContext<{ token: string | null }>({ token: null });

export function useSettingsAuth() {
  return useContext(SettingsAuthContext);
}

export default function SettingsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [linkedProviderToken, setLinkedProviderToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const session = data.session;
      const access = session?.access_token ?? null;
      setToken(access);
      setReady(true);
      if (!access) router.replace("/login");
      const providerToken = (session as any)?.provider_token as string | undefined;
      const providerRefresh = (session as any)?.provider_refresh_token as string | undefined;
      if (access && providerToken && providerToken !== linkedProviderToken) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/google/link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const access = session?.access_token ?? null;
      setToken(access);
      if (!access) router.replace("/login");
      const providerToken = (session as any)?.provider_token as string | undefined;
      const providerRefresh = (session as any)?.provider_refresh_token as string | undefined;
      if (access && providerToken && providerToken !== linkedProviderToken) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/google/link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`
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
  }, [router, linkedProviderToken]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/google/status`, {
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

  useEffect(() => {
    if (googleConnected === false && pathname.startsWith("/settings/ai")) {
      router.replace("/settings/connections");
    }
  }, [googleConnected, pathname, router]);

  const navItems = useMemo(() => {
    const items = [{ href: "/settings/connections", label: "Connections" }];
    if (googleConnected) {
      items.push({ href: "/settings/ai", label: "AI Tools" });
    }
    return items;
  }, [googleConnected]);

  if (!ready || !token) {
    return null;
  }

  return (
    <SettingsAuthContext.Provider value={{ token }}>
      <div className="min-h-screen px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col gap-6 md:flex-row">
            <aside className="glass rounded-3xl p-6 md:w-64 md:shrink-0">
              <p className="text-xs uppercase tracking-[0.3em] text-ink-400">
                Settings
              </p>
              <nav className="mt-6 flex flex-col gap-2">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-2xl px-4 py-2 text-sm transition ${
                        active
                          ? "bg-ink-900 text-white"
                          : "text-ink-600 dark:text-ink-900 hover:bg-ink-900/10 dark:hover:bg-white/70"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
            <main className="flex-1">
              <div className="glass rounded-3xl p-8">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </SettingsAuthContext.Provider>
  );
}
