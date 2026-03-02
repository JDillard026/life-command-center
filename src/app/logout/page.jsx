"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default function LogoutPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing out…");

  useEffect(() => {
    (async () => {
      try {
        if (!supabase) {
          setMsg("Supabase not configured.");
          return;
        }
        await supabase.auth.signOut();
        router.replace("/login");
      } catch (e) {
        setMsg(e?.message || "Sign out failed.");
      }
    })();
  }, [router]);

  return (
    <main className="container">
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 950 }}>Logout</div>
        <div className="muted" style={{ marginTop: 6 }}>{msg}</div>
      </div>
    </main>
  );
}