"use client";

const toneMap = {
  neutral: {
    glow: "rgba(120, 146, 214, 0.12)",
    border: "rgba(143, 171, 255, 0.14)",
    dot: "#9bb7ff",
  },
  green: {
    glow: "rgba(35, 196, 107, 0.13)",
    border: "rgba(70, 210, 126, 0.18)",
    dot: "#39d77b",
  },
  amber: {
    glow: "rgba(255, 171, 64, 0.14)",
    border: "rgba(255, 189, 96, 0.18)",
    dot: "#ffb85c",
  },
  red: {
    glow: "rgba(255, 95, 95, 0.14)",
    border: "rgba(255, 128, 128, 0.18)",
    dot: "#ff6b6b",
  },
};

export default function AdminStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}) {
  const palette = toneMap[tone] || toneMap.neutral;

  return (
    <article
      className="statCard"
      style={{
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 22px 60px rgba(0,0,0,0.28), 0 0 0 1px ${palette.border}, 0 0 40px ${palette.glow}`,
      }}
    >
      <div className="statTop">
        <div className="labelWrap">
          <span
            className="dot"
            style={{ background: palette.dot, boxShadow: `0 0 18px ${palette.dot}` }}
          />
          <span className="label">{label}</span>
        </div>

        {Icon ? (
          <div className="iconWrap">
            <Icon size={18} />
          </div>
        ) : null}
      </div>

      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}

      <style jsx>{`
        .statCard {
          border-radius: 24px;
          padding: 18px 18px 16px;
          background:
            linear-gradient(
              180deg,
              rgba(255,255,255,0.06),
              rgba(255,255,255,0.02) 24%,
              rgba(255,255,255,0.01) 42%,
              rgba(255,255,255,0) 100%
            ),
            rgba(8, 12, 20, 0.76);
          border: 1px solid rgba(255,255,255,0.04);
          backdrop-filter: blur(16px);
          min-height: 132px;
          display: grid;
          align-content: start;
          gap: 12px;
        }

        .statTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .labelWrap {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          flex: 0 0 auto;
        }

        .label {
          color: rgba(214, 226, 255, 0.72);
          font-size: 0.84rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .iconWrap {
          width: 36px;
          height: 36px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          color: rgba(235, 243, 255, 0.88);
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255,255,255,0.06);
          flex: 0 0 auto;
        }

        .value {
          font-size: clamp(1.45rem, 2.1vw, 1.95rem);
          font-weight: 800;
          line-height: 1;
          color: #f5f8ff;
          letter-spacing: -0.03em;
        }

        .hint {
          color: rgba(214, 226, 255, 0.66);
          font-size: 0.94rem;
          line-height: 1.45;
        }
      `}</style>
    </article>
  );
}