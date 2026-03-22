"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SideNav from "./SideNav";
import RippleProvider from "./RippleProvider";
import AiHelpPanel from "./AiHelpPanel";

const SIDEBAR_STORAGE_KEY = "lcc-sidebar-collapsed";

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved === "true") setCollapsed(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  function toggleDesktopSidebar() {
    setCollapsed((v) => !v);
  }

  return (
    <RippleProvider>
      <div className="relative min-h-screen overflow-x-clip bg-[#050913] text-white">
        {/* full app background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(circle at 12% 10%, rgba(57, 110, 255, 0.18), transparent 0 18%),
                radial-gradient(circle at 82% 8%, rgba(110, 76, 255, 0.14), transparent 0 16%),
                radial-gradient(circle at 50% 28%, rgba(0, 190, 255, 0.08), transparent 0 22%),
                linear-gradient(180deg, #040816 0%, #07101d 52%, #040816 100%)
              `,
            }}
          />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: `
                radial-gradient(rgba(255,255,255,0.55) 0.8px, transparent 0.8px),
                radial-gradient(rgba(140,180,255,0.22) 1px, transparent 1px),
                radial-gradient(rgba(255,255,255,0.22) 0.6px, transparent 0.6px)
              `,
              backgroundSize: "140px 140px, 220px 220px, 300px 300px",
              backgroundPosition: "0 0, 60px 110px, 120px 40px",
            }}
          />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background: `
                linear-gradient(90deg, rgba(26, 78, 196, 0.10), transparent 18%, transparent 82%, rgba(95, 47, 190, 0.08)),
                linear-gradient(180deg, rgba(255,255,255,0.02), transparent 20%, transparent 80%, rgba(255,255,255,0.02))
              `,
            }}
          />
        </div>

        {/* mobile open button */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          title="Open navigation"
          className={[
            "fixed left-3 top-3 z-[70] h-[56px] w-[56px] items-center justify-center rounded-[18px] border border-white/12 lg:hidden",
            "bg-[linear-gradient(180deg,rgba(12,20,36,0.96),rgba(5,10,18,0.98))]",
            "shadow-[0_12px_24px_rgba(0,0,0,0.32),0_0_18px_rgba(73,110,220,0.12),inset_0_1px_0_rgba(255,255,255,0.05)]",
            "backdrop-blur-md transition-all duration-200",
            mobileOpen
              ? "pointer-events-none opacity-0 scale-95"
              : "flex opacity-100 scale-100",
          ].join(" ")}
        >
          <Image
            src="/brand/lcc-logo.png"
            alt="Life Command Center logo"
            width={40}
            height={40}
            className="object-contain"
            priority
          />
        </button>

        {/* mobile overlay */}
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          className={[
            "fixed inset-0 z-[58] bg-black/58 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
            mobileOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
          ].join(" ")}
        />

        <div className="relative z-10 min-h-screen lg:flex">
          {/* desktop spacer so content never sits under sidebar */}
          <div
            className={[
              "hidden lg:block lg:shrink-0",
              collapsed
                ? "lg:w-[96px] lg:min-w-[96px] lg:max-w-[96px]"
                : "lg:w-[336px] lg:min-w-[336px] lg:max-w-[336px]",
            ].join(" ")}
          />

          {/* actual sidebar */}
          <aside
            className={[
              "fixed left-0 top-0 z-[60] h-screen overflow-visible border-r border-white/8 transition-transform duration-300 ease-out",
              "w-[88vw] max-w-[336px]",
              mobileOpen ? "translate-x-0" : "-translate-x-full",
              "lg:translate-x-0",
              collapsed
                ? "lg:w-[96px] lg:min-w-[96px] lg:max-w-[96px]"
                : "lg:w-[336px] lg:min-w-[336px] lg:max-w-[336px]",
            ].join(" ")}
          >
            <SideNav
              collapsed={collapsed}
              onToggle={toggleDesktopSidebar}
              onCloseMobile={() => setMobileOpen(false)}
            />
          </aside>

          <main className="relative z-10 min-w-0 flex-1 overflow-x-hidden px-0 pt-[84px] lg:pt-0">
            {children}
          </main>

          <AiHelpPanel />
        </div>
      </div>
    </RippleProvider>
  );
}