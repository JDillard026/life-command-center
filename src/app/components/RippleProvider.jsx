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

    let color = "rgba(255,255,255,0.95)";
    if (hue > 0.82) color = "rgba(168,221,255,0.95)";
    else if (hue > 0.68) color = "rgba(255,244,214,0.95)";
    else if (hue > 0.56) color = "rgba(214,232,255,0.95)";

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
  minOpacity: 0.14,
  maxOpacity: 0.52,
  minDuration: 5,
  maxDuration: 11,
});

const MID_STARS = makeSeededStars(55, 222, {
  minSize: 1.2,
  maxSize: 2.4,
  minOpacity: 0.22,
  maxOpacity: 0.82,
  minDuration: 4,
  maxDuration: 9,
});

const NEAR_STARS = makeSeededStars(16, 333, {
  minSize: 2.2,
  maxSize: 3.8,
  minOpacity: 0.28,
  maxOpacity: 1,
  minDuration: 3.5,
  maxDuration: 7,
});

const GLOW_STARS = makeSeededStars(9, 444, {
  minSize: 4,
  maxSize: 7,
  minOpacity: 0.16,
  maxOpacity: 0.4,
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
            opacity: 0.35;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.22);
          }
        }

        @keyframes lccTwinkleB {
          0%,
          100% {
            opacity: 0.25;
            transform: scale(0.92);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.12);
          }
        }

        @keyframes lccTwinkleC {
          0%,
          100% {
            opacity: 0.2;
            transform: scale(1);
          }
          40% {
            opacity: 0.72;
            transform: scale(1.06);
          }
          70% {
            opacity: 0.42;
            transform: scale(0.96);
          }
        }

        @keyframes lccNebulaDrift {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(0, -10px, 0) scale(1.03);
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
              "radial-gradient(circle at 50% 12%, rgba(10,18,34,0.26), transparent 28%), #02060d",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                radial-gradient(circle at 16% 18%, rgba(36, 94, 190, 0.12), transparent 18%),
                radial-gradient(circle at 78% 22%, rgba(89, 46, 132, 0.10), transparent 20%),
                radial-gradient(circle at 65% 72%, rgba(22, 80, 138, 0.08), transparent 24%),
                radial-gradient(circle at 28% 82%, rgba(17, 47, 99, 0.06), transparent 18%)
              `,
              animation: "lccNebulaDrift 18s ease-in-out infinite",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                radial-gradient(circle at 50% 50%, transparent 0%, transparent 62%, rgba(0,0,0,0.24) 100%),
                linear-gradient(180deg, rgba(0,0,0,0.16), rgba(0,0,0,0.28))
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
                boxShadow: `0 0 ${star.size * 5}px ${star.color}`,
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
                  0 0 ${star.size * 8}px ${star.color},
                  0 0 ${star.size * 16}px rgba(255,255,255,0.12)
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
                background: "rgba(255,255,255,0.18)",
                opacity: star.opacity,
                filter: "blur(1px)",
                boxShadow: `
                  0 0 ${star.size * 8}px rgba(255,255,255,0.20),
                  0 0 ${star.size * 18}px rgba(143,208,255,0.14)
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