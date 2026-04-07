"use client";

import React from "react";

function makeSeededStars(count, seed, options = {}) {
  const {
    minSize = 1,
    maxSize = 2.6,
    minOpacity = 0.18,
    maxOpacity = 0.95,
    minDuration = 3.5,
    maxDuration = 9,
  } = options;

  let s = seed;

  function rand() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  }

  return Array.from({ length: count }, (_, i) => {
    const x = rand() * 100;
    const y = rand() * 100;
    const size = minSize + rand() * (maxSize - minSize);
    const opacity = minOpacity + rand() * (maxOpacity - minOpacity);
    const duration = minDuration + rand() * (maxDuration - minDuration);
    const delay = rand() * 8;
    const hue = rand();

    let color = "rgba(255,255,255,0.94)";
    if (hue > 0.84) color = "rgba(196,220,255,0.94)";
    else if (hue > 0.7) color = "rgba(255,244,214,0.92)";
    else if (hue > 0.56) color = "rgba(220,232,255,0.94)";

    return {
      id: `star-${seed}-${i}`,
      x,
      y,
      size,
      opacity,
      duration,
      delay,
      color,
      anim:
        i % 3 === 0 ? "lccTwinkleA" : i % 3 === 1 ? "lccTwinkleB" : "lccTwinkleC",
    };
  });
}

const FAR_STARS = makeSeededStars(90, 111, {
  minSize: 0.8,
  maxSize: 1.8,
  minOpacity: 0.12,
  maxOpacity: 0.46,
  minDuration: 5,
  maxDuration: 11,
});

const MID_STARS = makeSeededStars(52, 222, {
  minSize: 1.2,
  maxSize: 2.2,
  minOpacity: 0.2,
  maxOpacity: 0.72,
  minDuration: 4,
  maxDuration: 9,
});

const NEAR_STARS = makeSeededStars(16, 333, {
  minSize: 2.1,
  maxSize: 3.4,
  minOpacity: 0.24,
  maxOpacity: 0.9,
  minDuration: 3.5,
  maxDuration: 7,
});

const GLOW_STARS = makeSeededStars(8, 444, {
  minSize: 4,
  maxSize: 6.6,
  minOpacity: 0.12,
  maxOpacity: 0.34,
  minDuration: 6,
  maxDuration: 12,
});

export default function RippleProvider({ children }) {
  return (
    <>
      <style jsx global>{`
        @keyframes lccTwinkleA {
          0%,
          100% {
            opacity: 0.34;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.18);
          }
        }

        @keyframes lccTwinkleB {
          0%,
          100% {
            opacity: 0.24;
            transform: scale(0.94);
          }
          50% {
            opacity: 0.82;
            transform: scale(1.1);
          }
        }

        @keyframes lccTwinkleC {
          0%,
          100% {
            opacity: 0.18;
            transform: scale(1);
          }
          40% {
            opacity: 0.68;
            transform: scale(1.05);
          }
          70% {
            opacity: 0.38;
            transform: scale(0.96);
          }
        }

        @keyframes lccNebulaDrift {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(0, -8px, 0) scale(1.02);
          }
        }
      `}</style>

      <div style={{ position: "relative", minHeight: "100vh" }}>
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
            zIndex: 0,
            background:
              "radial-gradient(circle at 50% 10%, rgba(10,16,28,0.28), transparent 28%), #01040a",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                radial-gradient(circle at 18% 18%, rgba(36, 64, 118, 0.10), transparent 18%),
                radial-gradient(circle at 76% 20%, rgba(48, 54, 88, 0.07), transparent 22%),
                radial-gradient(circle at 64% 72%, rgba(20, 44, 86, 0.06), transparent 24%),
                radial-gradient(circle at 28% 84%, rgba(14, 30, 62, 0.05), transparent 20%)
              `,
              animation: "lccNebulaDrift 18s ease-in-out infinite",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                radial-gradient(circle at 50% 50%, transparent 0%, transparent 62%, rgba(0,0,0,0.3) 100%),
                linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.26))
              `,
            }}
          />

          {FAR_STARS.map((star) => (
            <span
              key={star.id}
              style={{
                position: "absolute",
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                borderRadius: "999px",
                background: star.color,
                opacity: star.opacity,
                animation: `${star.anim} ${star.duration}s ease-in-out ${star.delay}s infinite`,
              }}
            />
          ))}

          {MID_STARS.map((star) => (
            <span
              key={star.id}
              style={{
                position: "absolute",
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                borderRadius: "999px",
                background: star.color,
                opacity: star.opacity,
                boxShadow: `0 0 ${star.size * 4}px ${star.color}`,
                animation: `${star.anim} ${star.duration}s ease-in-out ${star.delay}s infinite`,
              }}
            />
          ))}

          {NEAR_STARS.map((star) => (
            <span
              key={star.id}
              style={{
                position: "absolute",
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                borderRadius: "999px",
                background: star.color,
                opacity: star.opacity,
                boxShadow: `
                  0 0 ${star.size * 7}px ${star.color},
                  0 0 ${star.size * 14}px rgba(255,255,255,0.1)
                `,
                animation: `${star.anim} ${star.duration}s ease-in-out ${star.delay}s infinite`,
              }}
            />
          ))}

          {GLOW_STARS.map((star) => (
            <span
              key={star.id}
              style={{
                position: "absolute",
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                borderRadius: "999px",
                background: "rgba(255,255,255,0.16)",
                opacity: star.opacity,
                filter: "blur(1px)",
                boxShadow: `
                  0 0 ${star.size * 8}px rgba(255,255,255,0.18),
                  0 0 ${star.size * 18}px rgba(143,208,255,0.12)
                `,
                animation: `${star.anim} ${star.duration}s ease-in-out ${star.delay}s infinite`,
              }}
            />
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    </>
  );
}