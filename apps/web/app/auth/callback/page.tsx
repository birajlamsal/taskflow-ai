"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const hasCode = url.searchParams.has("code");
    const run = async () => {
      if (hasCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (!active) return;
        if (error) {
          setMessage(error.message);
          return;
        }
        router.replace("/dashboard");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        router.replace("/dashboard");
      } else {
        setMessage("Authentication failed. Please try again.");
      }
    };
    run().catch(() => {
      if (!active) return;
      setMessage("Authentication failed. Please try again.");
    });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-xl mx-auto glass rounded-3xl p-8">
        <p className="text-sm text-ink-600">{message}</p>
      </div>
    </div>
  );
}
