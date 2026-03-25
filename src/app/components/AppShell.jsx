// src/app/components/AppShell.jsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SideNav from "./SideNav";
import AiHelpPanel from "./AiHelpPanel";
import styles from "./AppShell.module.css";

const SIDEBAR_STORAGE_KEY = "lcc-sidebar-collapsed";

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

export default function AppShell({ children }) {
  const pathname = usePathname() || "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const hideAiHelp =
    pathname.startsWith("/investments") || pathname.startsWith("/market");

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <div
      className={cx(
        styles.shell,
        desktopCollapsed && styles.shellCollapsed
      )}
    >
      <div className={styles.cosmos} aria-hidden="true">
        <div className={styles.voidLayer} />
        <div className={styles.dustLayerA} />
        <div className={styles.dustLayerB} />
        <div className={styles.starFieldFar} />
        <div className={styles.starFieldMid} />
        <div className={styles.starFieldNear} />
        <div className={styles.vignette} />
      </div>

      <header className={styles.mobileTopbar}>
        <button
          type="button"
          className={styles.mobileMenuButton}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={styles.mobileBrand}>
          <div className={styles.mobileBrandMark}>LCC</div>
          <div className={styles.mobileBrandText}>Life Command Center</div>
        </div>

        <div className={styles.mobileTopbarSpacer} />
      </header>

      <div
        className={cx(
          styles.mobileOverlay,
          mobileOpen && styles.mobileOverlayOpen
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />

      <div className={styles.layout}>
        <aside
          className={cx(styles.sidebar, mobileOpen && styles.sidebarOpen)}
          aria-label="Primary navigation"
        >
          <SideNav
            collapsed={desktopCollapsed}
            onToggle={() => setDesktopCollapsed((v) => !v)}
            onCloseMobile={() => setMobileOpen(false)}
          />
        </aside>

        <main className={styles.main}>
          <div className={styles.page}>{children}</div>
        </main>
      </div>

      {!hideAiHelp ? <AiHelpPanel /> : null}
    </div>
  );
}