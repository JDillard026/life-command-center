"use client";

import SideNav from "./SideNav";
import RippleProvider from "./RippleProvider";

export default function AppShell({ children }) {
  return (
    <RippleProvider>
      <div className="flex min-h-screen w-full overflow-hidden bg-transparent">
        <aside className="shrink-0 border-r border-white/8">
          <div className="h-screen overflow-y-auto">
            <SideNav />
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="min-h-screen w-full">
            {children}
          </div>
        </main>
      </div>
    </RippleProvider>
  );
}