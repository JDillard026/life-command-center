"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub = null;

    async function boot() {
      // Allow auth routes without being logged in
      const isAuthRoute =
        pathname === "/login" || pathname?.startsWith("/auth/");

      if (!supabase) {
        // If env vars missing, don't brick the app — but warn.
        console.warn("Supabase env vars missing.");
        setReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const hasSession = !!data?.session;

      if (!hasSession && !isAuthRoute) {
        router.replace("/login");
      } else if (hasSession && pathname === "/login") {
        router.replace("/");
      }

      // Keep it live
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        const ok = !!session;
        const authRoute =
          pathname === "/login" || pathname?.startsWith("/auth/");
        if (!ok && !authRoute) router.replace("/login");
      });

      unsub = sub?.subscription;
      setReady(true);
    }

    boot();

    return () => {
      try {
        unsub?.unsubscribe?.();
      } catch {}
    };
  }, [router, pathname]);

  if (!ready) {
    return (
      <main className="container">
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 950 }}>Loading…</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Checking session
          </div>
        </div>
      </main>
    );
  }

  return children;
}