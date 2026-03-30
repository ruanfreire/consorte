import { useMemo } from "react";

const POOL = [
  "💛",
  "❤️",
  "🩷",
  "💖",
  "💕",
  "🎉",
  "🎊",
  "✨",
  "🥳",
  "🎂",
  "🎈",
  "🫶",
  "🐻",
  "💫",
  "🌟",
  "🔥",
];

export function FloatingParty({ count = 30 }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        emoji: POOL[Math.floor(Math.random() * POOL.length)],
        left: `${Math.random() * 86 + 7}%`,
        delay: Math.random() * 16,
        duration: 9 + Math.random() * 11,
        scale: 0.5 + Math.random() * 1.05,
        variant: i % 3,
      })),
    [count],
  );

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {items.map((p) => (
        <span
          key={p.key}
          style={{
            position: "absolute",
            left: p.left,
            bottom: "-14vh",
            fontSize: `clamp(${0.85 * p.scale}rem, ${3.8 * p.scale}vw, ${2.1 * p.scale}rem)`,
            lineHeight: 1,
            animation: `partyFloat${p.variant} ${p.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${p.delay}s infinite`,
            willChange: "transform",
          }}
        >
          {p.emoji}
        </span>
      ))}
      <style>{`
        @keyframes partyFloat0 {
          0% {
            transform: translate3d(0, 108vh, 0) rotate(-18deg) scale(0.55);
            opacity: 1;
          }
          20% {
            transform: translate3d(16px, 76vh, 0) rotate(55deg) scale(1.05);
          }
          40% {
            transform: translate3d(-22px, 52vh, 0) rotate(-40deg) scale(0.92);
          }
          60% {
            transform: translate3d(18px, 30vh, 0) rotate(140deg) scale(1.08);
          }
          80% {
            transform: translate3d(-12px, 10vh, 0) rotate(260deg) scale(0.98);
          }
          100% {
            transform: translate3d(8px, -24vh, 0) rotate(400deg) scale(0.65);
            opacity: 1;
          }
        }
        @keyframes partyFloat1 {
          0% {
            transform: translate3d(0, 112vh, 0) rotate(25deg) scale(0.5);
            opacity: 0;
          }
          4% {
            opacity: 1;
          }
          24% {
            transform: translate3d(-26px, 74vh, 0) rotate(-70deg) scale(1.12);
          }
          48% {
            transform: translate3d(22px, 46vh, 0) rotate(95deg) scale(0.85);
          }
          72% {
            transform: translate3d(-16px, 20vh, 0) rotate(220deg) scale(1.05);
          }
          100% {
            transform: translate3d(10px, -26vh, 0) rotate(540deg) scale(0.6);
            opacity: 0.15;
          }
        }
        @keyframes partyFloat2 {
          0% {
            transform: translate3d(0, 104vh, 0) rotate(0deg) scale(0.65);
            opacity: 1;
          }
          28% {
            transform: translate3d(24px, 68vh, 0) rotate(200deg) scale(1.18);
          }
          52% {
            transform: translate3d(-20px, 40vh, 0) rotate(80deg) scale(0.78);
          }
          76% {
            transform: translate3d(18px, 16vh, 0) rotate(300deg) scale(1.02);
          }
          100% {
            transform: translate3d(-14px, -22vh, 0) rotate(480deg) scale(0.72);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
