"use client";

import { useEffect, useState } from "react";
import { useSettingsAuth } from "./SettingsLayout";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ConnectionsSettings() {
  const { token } = useSettingsAuth();
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<{
    name?: string;
    email?: string;
    picture?: string;
  } | null>(null);

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
        const connected = Boolean(data.connected);
        setGoogleConnected(connected);
        if (connected) {
          const profileRes = await fetch(`${API_URL}/google/profile`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (profileRes.ok) {
            const profileData = (await profileRes.json()) as {
              name?: string;
              email?: string;
              picture?: string;
            };
            if (active) setProfile(profileData);
          }
        } else {
          setProfile(null);
        }
      })
      .catch(() => {
        if (!active) return;
        setGoogleConnected(false);
        setProfile(null);
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Settings</p>
        <h1 className="text-3xl font-semibold">Connections</h1>
      </div>

      <div className="rounded-2xl bg-ink-900/5 p-5 space-y-3">
        <p className="text-sm text-ink-600">Google Tasks</p>
        <p className="text-sm text-ink-500">
          Google is linked through Supabase Google login.
        </p>
        {googleConnected ? (
          <div className="flex items-center gap-3 rounded-2xl bg-ink-900/5 px-3 py-2">
            {profile?.picture ? (
              <img
                src={profile.picture}
                alt="Profile"
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-ink-900/10" />
            )}
            <div>
              <p className="text-sm font-medium">{profile?.name ?? "Connected"}</p>
              <p className="text-xs text-ink-500">{profile?.email ?? ""}</p>
            </div>
          </div>
        ) : null}
        {googleConnected ? (
          <p className="text-xs text-ink-500">Connected via Google sign-in.</p>
        ) : (
          <p className="text-xs text-ink-500">
            Sign out and sign in with Google to connect your Tasks.
          </p>
        )}
      </div>
    </div>
  );
}
