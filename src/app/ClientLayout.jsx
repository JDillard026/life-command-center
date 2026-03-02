"use client";

import { usePathname } from "next/navigation";
import AppShell from "./components/AppShell";

export default function ClientLayout({ children }) {
  const pathname = usePathname();

  const isAuthRoute =
    pathname === "/login" || pathname?.startsWith("/auth");

  // No sidebar / shell on login + auth callback routes
  if (isAuthRoute) return <>{children}</>;

  return <AppShell>{children}</AppShell>;
}