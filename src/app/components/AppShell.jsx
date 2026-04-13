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
const MOBILE_BREAKPOINT = "(max-width: 1100px)";

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

    const media = window.matchMedia(MOBILE_BREAKPOINT);

    const apply = () => {
      const nextIsMobile = media.matches;
      setIsMobileViewport(nextIsMobile);

      if (!nextIsMobile) {
        setMobileNavOpen(false);
      }
    };

    apply();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen]);

  function handleToggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
    }
  }

  function openMobileNav() {
    setMobileNavOpen(true);
  }

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  if (hideShell) {
    return <RippleProvider>{children}</RippleProvider>;
  }

  return (
    <RippleProvider>
      <div className={`${styles.shell} ${collapsed ? styles.shellCollapsed : ""}`}>
        <aside
          className={`${styles.sidebarColumn} ${collapsed ? styles.sidebarColumnCollapsed : ""}`}
          aria-hidden={isMobileViewport ? "true" : undefined}
        >
          <div className={styles.sidebarInner}>
            <SideNav collapsed={collapsed} onToggle={handleToggleCollapse} />
          </div>
        </aside>

        <div className={styles.mobileTopbar}>
          <button
            type="button"
            className={styles.mobileMenuBtn}
            onClick={openMobileNav}
            aria-label="Open navigation"
            aria-controls="lcc-mobile-drawer"
            aria-expanded={mobileNavOpen}
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
          <main id="lcc-main-content" className={styles.mainContent}>
            <div className={styles.pageFrame}>{children}</div>
          </main>
        </div>

        <button
          type="button"
          className={`${styles.mobileOverlay} ${mobileNavOpen ? styles.mobileOverlayOpen : ""}`}
          onClick={closeMobileNav}
          aria-label="Close navigation"
          aria-hidden={!mobileNavOpen}
          tabIndex={mobileNavOpen ? 0 : -1}
        />

        <aside
          id="lcc-mobile-drawer"
          className={`${styles.mobileDrawer} ${mobileNavOpen ? styles.mobileDrawerOpen : ""} ${collapsed ? styles.mobileDrawerCompact : ""}`}
          aria-hidden={!mobileNavOpen}
          role="dialog"
          aria-label="Navigation"
        >
          <div className={styles.mobileDrawerInner}>
            <SideNav
              collapsed={collapsed}
              mobile
              onToggle={handleToggleCollapse}
              onCloseMobile={closeMobileNav}
            />
          </div>
        </aside>
      </div>
    </RippleProvider>
  );
}
