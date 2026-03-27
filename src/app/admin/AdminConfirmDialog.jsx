"use client";

import { AlertTriangle } from "lucide-react";

export default function AdminConfirmDialog({
  open,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  const confirmClass = tone === "danger" ? "danger" : "neutral";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="iconWrap">
          <AlertTriangle size={22} />
        </div>

        <h3>{title}</h3>
        <p>{description}</p>

        <div className="actions">
          <button type="button" className="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`primary ${confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(2, 5, 12, 0.72);
          backdrop-filter: blur(10px);
        }

        .dialog {
          width: min(460px, 100%);
          border-radius: 26px;
          border: 1px solid rgba(151, 178, 255, 0.16);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
            rgba(8, 12, 20, 0.92);
          box-shadow:
            0 28px 80px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255,255,255,0.06);
          padding: 24px;
        }

        .iconWrap {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          color: #ffb85c;
          background: rgba(255, 184, 92, 0.1);
          border: 1px solid rgba(255, 184, 92, 0.18);
          margin-bottom: 14px;
        }

        h3 {
          margin: 0;
          font-size: 1.2rem;
          color: #f5f8ff;
        }

        p {
          margin: 10px 0 0;
          color: rgba(214, 226, 255, 0.7);
          line-height: 1.6;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        button {
          min-height: 44px;
          padding: 0 16px;
          border-radius: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .secondary {
          background: rgba(255, 255, 255, 0.045);
          color: #f5f8ff;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .primary {
          color: #fff;
          border: 1px solid transparent;
        }

        .primary.danger {
          background: linear-gradient(180deg, rgba(255,116,116,0.95), rgba(220,72,72,0.95));
          border-color: rgba(255, 128, 128, 0.18);
        }

        .primary.neutral {
          background: linear-gradient(180deg, rgba(103,138,255,0.95), rgba(67,103,220,0.95));
          border-color: rgba(147, 175, 255, 0.18);
        }

        button:disabled {
          opacity: 0.65;
          cursor: default;
        }

        @media (max-width: 520px) {
          .actions {
            flex-direction: column-reverse;
          }

          button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}