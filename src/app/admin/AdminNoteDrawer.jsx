"use client";

import { FileText, X } from "lucide-react";

export default function AdminNoteDrawer({
  open,
  user,
  value,
  onChange,
  onSave,
  onClose,
  saving = false,
}) {
  return (
    <div className={`drawerWrap ${open ? "open" : ""}`} aria-hidden={!open}>
      <button
        type="button"
        className={`drawerOverlay ${open ? "visible" : ""}`}
        onClick={onClose}
      />

      <aside className={`drawer ${open ? "open" : ""}`}>
        <div className="drawerHeader">
          <div>
            <div className="eyebrow">Support Note</div>
            <h3>{user ? user.name : "No user selected"}</h3>
            <p>{user ? user.email : "Select a user to write a note."}</p>
          </div>

          <button type="button" className="iconBtn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="userMeta">
          <span className="metaPill">{user?.role || "role"}</span>
          <span className="metaPill">{user?.status || "status"}</span>
        </div>

        <div className="noteBox">
          <div className="noteLabel">
            <FileText size={16} />
            <span>Internal admin note</span>
          </div>

          <textarea
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            placeholder="Write support context, follow-up details, billing notes, or account flags..."
          />
        </div>

        <div className="drawerFooter">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save note"}
          </button>
        </div>
      </aside>

      <style jsx>{`
        .drawerWrap {
          pointer-events: none;
        }

        .drawerOverlay {
          position: fixed;
          inset: 0;
          z-index: 74;
          border: 0;
          opacity: 0;
          background: rgba(4, 7, 13, 0.56);
          backdrop-filter: blur(8px);
          transition: opacity 180ms ease;
        }

        .drawerOverlay.visible {
          opacity: 1;
          pointer-events: auto;
        }

        .drawer {
          position: fixed;
          top: 0;
          right: 0;
          z-index: 75;
          width: min(500px, 100%);
          height: 100vh;
          padding: 22px;
          display: grid;
          grid-template-rows: auto auto 1fr auto;
          gap: 16px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
            rgba(7, 11, 18, 0.95);
          border-left: 1px solid rgba(147, 175, 255, 0.16);
          box-shadow:
            -16px 0 60px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255,255,255,0.05);
          transform: translateX(104%);
          transition: transform 220ms ease;
          pointer-events: auto;
        }

        .drawer.open {
          transform: translateX(0);
        }

        .drawerHeader {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
        }

        .eyebrow {
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: rgba(141, 174, 255, 0.84);
          font-weight: 800;
          margin-bottom: 8px;
        }

        h3 {
          margin: 0;
          font-size: 1.3rem;
          color: #f5f8ff;
        }

        p {
          margin: 8px 0 0;
          color: rgba(214, 226, 255, 0.68);
          line-height: 1.5;
        }

        .iconBtn {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #f5f8ff;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .userMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .metaPill {
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(230, 238, 255, 0.88);
          font-size: 0.82rem;
          font-weight: 700;
          text-transform: capitalize;
        }

        .noteBox {
          min-height: 0;
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 10px;
          padding: 14px;
          border-radius: 22px;
          background: rgba(4, 8, 14, 0.7);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .noteLabel {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(214, 226, 255, 0.74);
          font-size: 0.88rem;
          font-weight: 700;
        }

        textarea {
          width: 100%;
          min-height: 260px;
          resize: none;
          border: 0;
          outline: none;
          background: transparent;
          color: #f5f8ff;
          line-height: 1.6;
          font-size: 0.98rem;
        }

        textarea::placeholder {
          color: rgba(214, 226, 255, 0.4);
        }

        .drawerFooter {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .secondary,
        .primary {
          min-height: 44px;
          padding: 0 16px;
          border-radius: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        .secondary {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #f5f8ff;
        }

        .primary {
          border: 1px solid rgba(147, 175, 255, 0.18);
          background: linear-gradient(180deg, rgba(103,138,255,0.95), rgba(67,103,220,0.95));
          color: #ffffff;
        }

        .secondary:disabled,
        .primary:disabled {
          opacity: 0.65;
          cursor: default;
        }

        @media (max-width: 540px) {
          .drawer {
            padding: 18px 16px;
          }

          .drawerFooter {
            flex-direction: column-reverse;
          }

          .secondary,
          .primary {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}