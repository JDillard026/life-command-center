"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

const toneMap = {
  success: {
    icon: CheckCircle2,
    className: "success",
  },
  error: {
    icon: AlertTriangle,
    className: "error",
  },
  info: {
    icon: Info,
    className: "info",
  },
};

export default function AdminActionToast({
  open = false,
  message = "",
  tone = "success",
  duration = 2200,
  onClose,
}) {
  useEffect(() => {
    if (!open || !onClose) return;

    const timer = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!open || !message) return null;

  const palette = toneMap[tone] || toneMap.success;
  const Icon = palette.icon;

  return (
    <div className={`toast ${palette.className}`}>
      <div className="left">
        <div className="iconWrap">
          <Icon size={18} />
        </div>
        <span className="message">{message}</span>
      </div>

      <button type="button" className="closeBtn" onClick={onClose} aria-label="Close toast">
        <X size={16} />
      </button>

      <style jsx>{`
        .toast {
          position: sticky;
          top: 10px;
          z-index: 40;
          width: fit-content;
          max-width: min(460px, 100%);
          justify-self: end;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          min-height: 48px;
          padding: 10px 12px;
          border-radius: 16px;
          backdrop-filter: blur(16px);
          box-shadow:
            0 16px 34px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .toast.success {
          background:
            linear-gradient(180deg, rgba(58, 195, 113, 0.95), rgba(35, 143, 79, 0.95));
          color: #ffffff;
        }

        .toast.error {
          background:
            linear-gradient(180deg, rgba(255, 116, 116, 0.96), rgba(212, 68, 68, 0.96));
          color: #ffffff;
        }

        .toast.info {
          background:
            linear-gradient(180deg, rgba(103, 138, 255, 0.96), rgba(67, 103, 220, 0.96));
          color: #ffffff;
        }

        .left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .iconWrap {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.14);
          flex: 0 0 auto;
        }

        .message {
          font-weight: 800;
          line-height: 1.35;
        }

        .closeBtn {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          border: 0;
          background: rgba(255,255,255,0.14);
          color: inherit;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex: 0 0 auto;
        }

        @media (max-width: 640px) {
          .toast {
            justify-self: stretch;
            width: 100%;
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}