"use client";

import { useEffect } from "react";

export default function RippleProvider() {
  useEffect(() => {
    function handleMouseDown(e) {
      const btn = e.target.closest(".btn, .btnGhost");
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const dot = document.createElement("span");
      dot.className = "rippleDot";
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.width = "8px";
      dot.style.height = "8px";

      btn.appendChild(dot);
      setTimeout(() => dot.remove(), 650);
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return null;
}