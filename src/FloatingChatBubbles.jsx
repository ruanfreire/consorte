import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PHOTO_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><circle cx="36" cy="36" r="36" fill="#6b6b6b"/></svg>',
  );

/** Só uma bolha em ecrã; a seguinte só depois deste intervalo (ms). */
const SPAWN_INTERVAL_MS = 3400;
/** Atraso antes da primeira bolha (ms). */
const FIRST_SPAWN_MS = 900;

/**
 * Uma bolha de cada vez (substitui a anterior), posição e rotação aleatórias.
 * Layout responsivo: coluna em telemóvel, safe-area, texto com min-width:0.
 */
export function FloatingChatBubbles({ entries }) {
  const valid = useMemo(
    () =>
      entries.filter((e) => {
        const t = String(e.text ?? "").trim();
        return t.length > 0;
      }),
    [entries],
  );

  const entriesKey = useMemo(() => valid.map((e) => e.id).join("|"), [valid]);

  const [bubble, setBubble] = useState(null);
  const spawnIdxRef = useRef(0);
  const idSeq = useRef(0);

  const pickEntry = useCallback(() => {
    if (!valid.length) return null;
    const i = spawnIdxRef.current % valid.length;
    spawnIdxRef.current += 1;
    return valid[i];
  }, [valid]);

  useEffect(() => {
    if (!valid.length) {
      setBubble(null);
      return;
    }

    spawnIdxRef.current = 0;

    const spawnOne = () => {
      const e = pickEntry();
      if (!e) return;

      const photo = String(e.photo ?? "").trim() ? e.photo : PHOTO_FALLBACK;
      const key = `bubble-${++idSeq.current}`;
      const leftPct = 6 + Math.random() * 82;
      const topPct = 12 + Math.random() * 52;
      const tiltDeg = -9 + Math.random() * 18;

      setBubble({
        key,
        text: e.text,
        photo,
        leftPct,
        topPct,
        tiltDeg,
      });
    };

    const t0 = setTimeout(spawnOne, FIRST_SPAWN_MS);
    const interval = setInterval(spawnOne, SPAWN_INTERVAL_MS);

    return () => {
      clearTimeout(t0);
      clearInterval(interval);
    };
  }, [entriesKey, valid, pickEntry]);

  if (!bubble) return null;

  return (
    <div
      aria-hidden
      className="bubble-floating-layer"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 1,
        boxSizing: "border-box",
        padding:
          "max(10px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(14px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))",
      }}
    >
      <BubbleCard key={bubble.key} row={bubble} />
      <style>{`
        @keyframes bubbleBurstIn {
          0% {
            transform: translate(-50%, -50%) rotate(var(--tilt, 0deg)) scale(0.15);
            opacity: 0;
            filter: blur(14px);
          }
          45% {
            transform: translate(-50%, -50%) rotate(var(--tilt, 0deg)) scale(1.14);
            opacity: 1;
            filter: blur(0);
          }
          68% {
            transform: translate(-50%, -50%) rotate(var(--tilt, 0deg)) scale(0.96);
            filter: blur(0);
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--tilt, 0deg)) scale(1);
            opacity: 1;
            filter: blur(0);
          }
        }
        @keyframes avatarPop {
          0% { transform: scale(0.6); }
          55% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes ringPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bubble-floating-card {
            animation: none !important;
            filter: none !important;
            opacity: 1 !important;
            transform: translate(-50%, -50%) rotate(0deg) scale(1) !important;
          }
          .bubble-floating-card .bubble-avatar-ring {
            animation: none !important;
            opacity: 0.5;
          }
        }
        @media (max-width: 520px) {
          .bubble-chat-inner {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center;
            gap: 10px !important;
            max-width: 100%;
          }
          .bubble-text {
            max-width: 100% !important;
            text-align: center !important;
          }
        }
      `}</style>
    </div>
  );
}

function BubbleCard({ row }) {
  const tilt = `${row.tiltDeg}deg`;

  return (
    <div
      className="bubble-floating-card"
      style={{
        position: "absolute",
        left: `${row.leftPct}%`,
        top: `${row.topPct}%`,
        transform: "translate(-50%, -50%)",
        "--tilt": tilt,
        animation: "bubbleBurstIn 0.72s cubic-bezier(0.22, 1.28, 0.36, 1) both",
        willChange: "transform, opacity, filter",
        width: "100%",
        maxWidth: "min(92vw, 360px)",
        boxSizing: "border-box",
      }}
    >
      <div
        className="bubble-chat-inner"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(8px, 2.5vw, 14px)",
          position: "relative",
          width: "100%",
          minWidth: 0,
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            className="bubble-avatar-ring"
            aria-hidden
            style={{
              position: "absolute",
              inset: "clamp(-4px, -1vw, -6px)",
              borderRadius: "50%",
              border: "2px solid rgba(255, 210, 120, 0.55)",
              animation: "ringPulse 2.2s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
          <img
            src={row.photo}
            alt=""
            style={{
              width: "clamp(36px, 11vw, 52px)",
              height: "clamp(36px, 11vw, 52px)",
              borderRadius: "50%",
              objectFit: "cover",
              display: "block",
              border: "2px solid rgba(255,255,255,0.5)",
              boxShadow:
                "0 4px 18px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,200,100,0.35)",
              animation: "avatarPop 0.55s cubic-bezier(0.34, 1.4, 0.52, 1) 0.05s both",
            }}
          />
        </div>
        <div
          className="bubble-text"
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            background: "linear-gradient(145deg, #ffffff 0%, #f8f4ee 100%)",
            color: "#1a1a1a",
            padding: "clamp(10px, 2.8vw, 14px) clamp(12px, 3.5vw, 18px)",
            borderRadius: "clamp(14px, 4vw, 22px)",
            fontSize: "clamp(12px, 3.4vw, 15px)",
            lineHeight: 1.45,
            textAlign: "center",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            fontFamily: "system-ui, sans-serif",
            border: "1px solid rgba(255,200,100,0.45)",
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.22), 0 0 28px rgba(255, 190, 90, 0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          {row.text}
        </div>
      </div>
    </div>
  );
}
