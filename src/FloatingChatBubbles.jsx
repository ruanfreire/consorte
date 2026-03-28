import { useMemo } from "react";

const PHOTO_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><circle cx="36" cy="36" r="36" fill="#6b6b6b"/></svg>',
  );

/**
 * Bolhas estilo chat (avatar + texto) subindo ao centro da tela.
 */
export function FloatingChatBubbles({ entries }) {
  const instances = useMemo(() => {
    if (!entries.length) return [];
    const out = [];
    entries.forEach((e, i) => {
      if (!String(e.text ?? "").trim()) return;
      const photo = String(e.photo ?? "").trim() ? e.photo : PHOTO_FALLBACK;
      for (let k = 0; k < 2; k++) {
        const seed = (i * 31 + k * 17) % 100;
        out.push({
          key: `${e.id}-${k}`,
          text: e.text,
          photo,
          delay: (seed * 0.17 + k * 6 + i * 2.5) % 22,
          duration: 22 + (seed % 14),
        });
      }
    });
    return out;
  }, [entries]);

  if (!instances.length) return null;

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
      {instances.map((row) => (
        <div
          key={row.key}
          style={{
            position: "absolute",
            left: "50%",
            bottom: "-120px",
            animation: `chatBubbleRise ${row.duration}s linear ${row.delay}s infinite`,
            willChange: "transform",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              maxWidth: "min(92vw, 340px)",
              marginLeft: "auto",
              marginRight: "auto",
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
                background: "rgba(255,255,255,0.94)",
                color: "#1a1a1a",
                padding: "10px 14px",
                borderRadius: 18,
                fontSize: "clamp(11px, 3.1vw, 13px)",
                lineHeight: 1.35,
                textAlign: "center",
                wordBreak: "break-word",
                fontFamily: "system-ui, sans-serif",
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              }}
            >
              {row.text}
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes chatBubbleRise {
          0% {
            transform: translate(-50%, 0);
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          100% {
            transform: translate(-50%, calc(-100dvh - 180px));
            opacity: 0.75;
          }
        }
      `}</style>
    </div>
  );
}
