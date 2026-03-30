import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PHOTO_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><circle cx="36" cy="36" r="36" fill="#6b6b6b"/></svg>',
  );

/** Intervalo entre uma bolha e a seguinte (nunca todas ao mesmo tempo). */
const SPAWN_INTERVAL_MS = 1700;
/** Tempo em ecrã até a bolha ser removida. */
const BUBBLE_LIFETIME_MS = 5500;
/** Máximo de bolhas vivas (evita acumular centenas). */
const MAX_ACTIVE = 14;

/**
 * Bolhas estilo chat: aparecem uma de cada vez, em posições variadas,
 * com animação de “explosão” (escala), não em fila contínua todas de uma vez.
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

  const [active, setActive] = useState([]);
  const spawnIdxRef = useRef(0);
  const idSeq = useRef(0);

  const removeBubble = useCallback((key) => {
    setActive((prev) => prev.filter((b) => b.key !== key));
  }, []);

  useEffect(() => {
    if (!valid.length) {
      setActive([]);
      return;
    }

    spawnIdxRef.current = 0;

    const spawnOne = () => {
      const e = valid[spawnIdxRef.current % valid.length];
      spawnIdxRef.current += 1;

      const photo = String(e.photo ?? "").trim() ? e.photo : PHOTO_FALLBACK;
      const key = `bubble-${++idSeq.current}`;
      const leftPct = 5 + Math.random() * 82;
      const topPct = 8 + Math.random() * 62;

      setActive((prev) => {
        const next = [
          ...prev,
          {
            key,
            text: e.text,
            photo,
            leftPct,
            topPct,
          },
        ];
        return next.slice(-MAX_ACTIVE);
      });
    };

    const t0 = setTimeout(spawnOne, 400);
    const interval = setInterval(spawnOne, SPAWN_INTERVAL_MS);

    return () => {
      clearTimeout(t0);
      clearInterval(interval);
    };
  }, [entriesKey, valid]);

  if (!active.length) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {active.map((row) => (
        <BubbleInstance
          key={row.key}
          row={row}
          onExpire={() => removeBubble(row.key)}
        />
      ))}
      <style>{`
        @keyframes bubbleExplodeIn {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          58% {
            transform: translate(-50%, -50%) scale(1.12);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function BubbleInstance({ row, onExpire }) {
  useEffect(() => {
    const t = setTimeout(onExpire, BUBBLE_LIFETIME_MS);
    return () => clearTimeout(t);
  }, [row.key, onExpire]);

  return (
    <div
      style={{
        position: "absolute",
        left: `${row.leftPct}%`,
        top: `${row.topPct}%`,
        transform: "translate(-50%, -50%)",
        animation: "bubbleExplodeIn 0.55s cubic-bezier(0.34, 1.45, 0.52, 1) both",
        willChange: "transform, opacity",
        maxWidth: "min(88vw, 320px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <img
          src={row.photo}
          alt=""
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
            border: "2px solid rgba(255,255,255,0.35)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          }}
        />
        <div
          style={{
            background: "#fff",
            color: "#1a1a1a",
            padding: "10px 14px",
            borderRadius: 18,
            fontSize: "clamp(11px, 3.1vw, 13px)",
            lineHeight: 1.35,
            textAlign: "center",
            wordBreak: "break-word",
            fontFamily: "system-ui, sans-serif",
            boxShadow: "0 6px 20px rgba(0,0,0,0.28)",
          }}
        >
          {row.text}
        </div>
      </div>
    </div>
  );
}
