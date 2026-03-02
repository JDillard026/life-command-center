"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Finishing login…");

  useEffect(() => {
    (async () => {
      try {
        if (!supabase) {
          setMsg("Missing Supabase env vars.");
          return;
        }
        // For OAuth redirect w/ code
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;

        router.replace("/");
      } catch (e) {
        setMsg(e?.message || "Auth callback failed.");
      }
    })();
  }, [router]);

  return (
    <main className="container">
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 950 }}>Auth</div>
        <div className="muted" style={{ marginTop: 6 }}>{msg}</div>
      </div>
    </main>
  );
}