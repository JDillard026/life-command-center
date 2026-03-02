"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function hasHashTokens() {
  const h = window.location.hash || "";
  return h.includes("access_token=") || h.includes("refresh_token=");
}

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

        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // 1) PKCE / Authorization Code flow
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;

          router.replace("/");
          return;
        }

        // 2) Implicit flow (hash tokens)
        if (hasHashTokens()) {
          const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: true });
          if (error) throw error;

          if (!data?.session) {
            throw new Error("No session returned from URL.");
          }

          router.replace("/");
          return;
        }

        // 3) Nothing usable in the URL
        setMsg("Auth callback missing code/tokens. Go back to /login and try Google again.");
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