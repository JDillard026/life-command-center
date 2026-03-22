"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SideNav from "./SideNav";
import RippleProvider from "./RippleProvider";
import AiHelpPanel from "./AiHelpPanel";

export default function AppShell({ children }) {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Close menu when navigating
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock scroll ONLY when menu open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [mobileOpen]);

  return (
    <RippleProvider>
      <div className="relative min-h-screen bg-[#050913] text-white overflow-x-hidden">
        
        {/* ===== MOBILE TOP BAR ===== */}
        <div className="fixed top-0 left-0 right-0 z-[50] flex items-center justify-between px-4 py-3 bg-[#081120]/90 backdrop-blur border-b border-white/10 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center"
          >
            ☰
          </button>

          <div className="text-sm font-bold tracking-widest">
            LCC
          </div>

          <div className="w-10" />
        </div>

        {/* ===== OVERLAY (FIXED) ===== */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* ===== SIDEBAR ===== */}
        <aside
          className={`
            fixed top-0 left-0 h-full w-[85%] max-w-[320px]
            z-[70] bg-[#07101d]
            transform transition-transform duration-300
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
            
            lg:translate-x-0 lg:static lg:w-[300px]
          `}
        >
          <SideNav onNavigate={() => setMobileOpen(false)} />
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main
          className={`
            relative z-[10]
            pt-[70px] px-3 pb-20
            lg:pt-6 lg:pl-[300px]
          `}
        >
          {children}
        </main>

        {/* ===== AI PANEL (DESKTOP ONLY) ===== */}
        <div className="hidden xl:block">
          <AiHelpPanel />
        </div>

      </div>
    </RippleProvider>
  );
}