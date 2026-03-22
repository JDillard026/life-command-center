"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserRole } from "@/lib/getCurrentUserRole";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      const { user, role } = await getCurrentUserRole();

      if (!mounted) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      if (role !== "admin") {
        router.replace("/");
        return;
      }

      setStatus("allowed");
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (status === "loading") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-5 text-white/80 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          Checking admin access...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}