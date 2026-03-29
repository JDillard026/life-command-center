"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import SideNav from "./SideNav";
import RippleProvider from "./RippleProvider";
import AiHelpPanel from "./AiHelpPanel";
import styles from "./AppShell.module.css";

const HIDE_SHELL_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

function shouldHideShell(pathname = "") {
  if (!pathname) return false;
  if (HIDE_SHELL_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith("/auth")) return true;
  return false;
}

export default function AppShell({ children }) {
  const pathname = usePathname() || "";
  const hideShell = useMemo(() => shouldHideShell(pathname), [pathname]);

  if (hideShell) {
    return <RippleProvider>{children}</RippleProvider>;
  }

  return (
    <RippleProvider>
      <div className={styles.shell}>
        <aside className={styles.sidebarColumn}>
          <div className={styles.sidebarInner}>
            <SideNav />
          </div>
        </aside>

        <div className={styles.mainColumn}>
          <main className={styles.mainContent}>
            <div className={styles.pageFrame}>{children}</div>
          </main>
        </div>

        {/* <AiHelpPanel /> */}
      </div>
    </RippleProvider>
  );
}