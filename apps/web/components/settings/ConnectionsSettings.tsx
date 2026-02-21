"use client";

import { useEffect, useState } from "react";
import { useSettingsAuth } from "./SettingsLayout";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ConnectionsSettings() {
  const { token } = useSettingsAuth();
  const [message, setMessage] = useState("Connect Google Tasks to sync lists.");
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

  async function connectGoogle() {
    if (!token) return;
    setMessage("Starting Google OAuth...");
    try {
      const res = await fetch(`${API_URL}/auth/google/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Failed with ${res.status}`);
      }
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      setMessage(data.error ?? "Unable to start Google OAuth.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to start Google OAuth.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Settings</p>
        <h1 className="text-3xl font-semibold">Connections</h1>
      </div>

      <div className="rounded-2xl bg-ink-900/5 p-5 space-y-3">
        <p className="text-sm text-ink-600">Google Tasks</p>
        <p className="text-sm text-ink-500">
          Connect your Google account to sync task lists and tasks.
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
        <button onClick={connectGoogle} className="glass px-5 py-2 rounded-full text-sm">
          {googleConnected ? "Reconnect Google" : "Connect Google"}
        </button>
        <p className="text-xs text-ink-500">{message}</p>
      </div>
    </div>
  );
}
