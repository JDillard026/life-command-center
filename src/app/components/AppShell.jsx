"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SideNav from "./SideNav";
import RippleProvider from "./RippleProvider";
import AiHelpPanel from "./AiHelpPanel";

const SIDEBAR_STORAGE_KEY = "lcc-sidebar-collapsed";

export default function AppShell({ children }) {
  const pathname = usePathname() || "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      setDesktopCollapsed(saved === "true");
    } catch {
      setDesktopCollapsed(false);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        String(desktopCollapsed)
      );
    } catch {}
  }, [desktopCollapsed]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <RippleProvider>
      <div
        className={`app-shell ${desktopCollapsed ? "sidebar-collapsed" : ""}`}
      >
        <header className="mobile-topbar lg:hidden">
          <button
            type="button"
            className="mobile-topbar__menu"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>

          <div className="mobile-topbar__brand">LCC</div>

          <div className="mobile-topbar__spacer" />
        </header>

        <div
          className={`mobile-overlay ${mobileOpen ? "is-open" : ""}`}
          onClick={() => setMobileOpen(false)}
          aria-hidden={!mobileOpen}
        />

        <aside
          className={`app-sidebar ${mobileOpen ? "is-open" : ""}`}
          aria-label="Primary navigation"
        >
          <SideNav
            collapsed={desktopCollapsed}
            onToggle={() => setDesktopCollapsed((v) => !v)}
            onCloseMobile={() => setMobileOpen(false)}
          />
        </aside>

        <main className="app-main">
          <div className="app-page">{children}</div>
        </main>

        <div className="app-ai-rail hidden 2xl:block">
          <AiHelpPanel />
        </div>
      </div>
    </RippleProvider>
  );
}