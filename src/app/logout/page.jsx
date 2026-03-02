"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        await supabase?.auth.signOut();
      } finally {
        router.replace("/login");
      }
    })();
  }, [router]);

  return (
    <main className="container">
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 950 }}>Signing out…</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Redirecting to login
        </div>
      </div>
    </main>
  );
}