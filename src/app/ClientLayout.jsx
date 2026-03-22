"use client";

import { usePathname } from "next/navigation";
import AppShell from "./components/AppShell";

const SHELL_HIDDEN_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

export default function ClientLayout({ children }) {
  const pathname = usePathname() || "";

  const hideShell =
    SHELL_HIDDEN_ROUTES.some((route) => pathname === route) ||
    pathname.startsWith("/auth");

  if (hideShell) return <>{children}</>;

  return <AppShell>{children}</AppShell>;
}