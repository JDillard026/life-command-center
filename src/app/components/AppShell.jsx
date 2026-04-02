"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import SideNav from "./SideNav";
import RippleProvider from "./RippleProvider";
import styles from "./AppShell.module.css";

const HIDE_SHELL_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

const COLLAPSE_STORAGE_KEY = "lcc-sidebar-collapsed";

function shouldHideShell(pathname = "") {
  if (!pathname) return false;
  if (HIDE_SHELL_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith("/auth")) return true;
  return false;
}

function pageTitleFromPath(pathname = "") {
  if (!pathname || pathname === "/") return "Dashboard";
  const segment = pathname.split("/").filter(Boolean)[0] || "Dashboard";
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AppShell({ children }) {
  const pathname = usePathname() || "";
  const hideShell = useMemo(() => shouldHideShell(pathname), [pathname]);
  const pageTitle = useMemo(() => pageTitleFromPath(pathname), [pathname]);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    setCollapsed(saved === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 1100px)");
    const apply = () => {
      const nextIsMobile = media.matches;
      setIsMobileViewport(nextIsMobile);
      if (!nextIsMobile) {
        setMobileNavOpen(false);
      }
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.body.classList.toggle("lcc-nav-open", mobileNavOpen);
    return () => document.body.classList.remove("lcc-nav-open");
  }, [mobileNavOpen]);

  function handleToggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
    }
  }

  if (hideShell) {
    return <RippleProvider>{children}</RippleProvider>;
  }

  return (
    <RippleProvider>
      <div className={styles.shell}>
        <aside
          className={`${styles.sidebarColumn} ${collapsed ? styles.sidebarColumnCollapsed : ""}`}
          aria-hidden={isMobileViewport}
        >
          <div className={styles.sidebarInner}>
            <SideNav collapsed={collapsed} onToggle={handleToggleCollapse} />
          </div>
        </aside>

        <div className={styles.mobileTopbar}>
          <button
            type="button"
            className={styles.mobileMenuBtn}
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>

          <div className={styles.mobileTopbarCopy}>
            <div className={styles.mobileTopbarEyebrow}>Life Command Center</div>
            <div className={styles.mobileTopbarTitle}>{pageTitle}</div>
          </div>

          <button
            type="button"
            className={styles.mobileCollapseBtn}
            onClick={handleToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <div className={styles.mainColumn}>
          <main className={styles.mainContent}>
            <div className={styles.pageFrame}>{children}</div>
          </main>
        </div>

        <div
          className={`${styles.mobileOverlay} ${mobileNavOpen ? styles.mobileOverlayOpen : ""}`}
          onClick={() => setMobileNavOpen(false)}
          aria-hidden={!mobileNavOpen}
        />

        <aside
          className={`${styles.mobileDrawer} ${mobileNavOpen ? styles.mobileDrawerOpen : ""}`}
          aria-hidden={!mobileNavOpen}
        >
          <div className={styles.mobileDrawerInner}>
            <SideNav
              collapsed={false}
              mobile
              onToggle={handleToggleCollapse}
              onCloseMobile={() => setMobileNavOpen(false)}
            />
          </div>
        </aside>
      </div>
    </RippleProvider>
  );
}
