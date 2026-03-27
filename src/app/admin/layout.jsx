"use client";

import { Loader2, Shield } from "lucide-react";
import useRequireRole from "@/hooks/useRequireRole";

export default function AdminLayout({ children }) {
  const { loading, allowed } = useRequireRole({
    roles: ["admin"],
    redirectTo: "/",
    loginPath: "/login",
  });

  if (loading || !allowed) {
    return (
      <div className="adminGate">
        <div className="adminGateCard">
          <div className="adminGateIcon">
            {loading ? <Loader2 className="spin" size={26} /> : <Shield size={26} />}
          </div>

          <h1>{loading ? "Checking admin access" : "Redirecting"}</h1>
          <p>
            {loading
              ? "Verifying your role and loading the admin workspace."
              : "You do not have access to this area."}
          </p>
        </div>

        <style jsx>{`
          .adminGate {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background:
              radial-gradient(circle at top, rgba(57, 89, 168, 0.18), transparent 38%),
              radial-gradient(circle at 85% 10%, rgba(29, 185, 84, 0.08), transparent 28%),
              linear-gradient(180deg, #04070c 0%, #08101b 100%);
          }

          .adminGateCard {
            width: min(460px, 100%);
            border-radius: 28px;
            border: 1px solid rgba(148, 174, 255, 0.18);
            background: rgba(7, 11, 18, 0.78);
            backdrop-filter: blur(18px);
            box-shadow:
              0 24px 80px rgba(0, 0, 0, 0.44),
              inset 0 1px 0 rgba(255, 255, 255, 0.06);
            padding: 28px;
            text-align: center;
          }

          .adminGateIcon {
            width: 58px;
            height: 58px;
            margin: 0 auto 16px;
            border-radius: 18px;
            display: grid;
            place-items: center;
            color: #dbe7ff;
            background:
              linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
              rgba(33, 46, 76, 0.72);
            border: 1px solid rgba(148, 174, 255, 0.24);
          }

          h1 {
            margin: 0;
            color: #eef4ff;
            font-size: 1.3rem;
            font-weight: 700;
          }

          p {
            margin: 10px 0 0;
            color: rgba(214, 226, 255, 0.72);
            line-height: 1.55;
          }

          .spin {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return children;
}