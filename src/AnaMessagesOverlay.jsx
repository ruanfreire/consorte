import { useEffect, useMemo, useRef, useState } from "react";
import { AnaMessageModal } from "./AnaMessageModal.jsx";
import { FloatingChatBubbles } from "./FloatingChatBubbles.jsx";
import { loadAnaMessages, subscribeAnaMessages } from "./anaMessagesStorage.js";

/** Junta entrada otimista à lista; evita duplicar quando o Supabase já devolveu o registo. */
function mergeOptimisticEntries(entries, optimistic) {
  if (!optimistic) return entries;
  const duplicate = entries.some(
    (e) => e.text === optimistic.text && e.photo === optimistic.photo,
  );
  if (duplicate) return entries;
  return [...entries, optimistic];
}

/**
 * Botão fixo + bolhas + modal para mensagens à Ana.
 * Persistência: Supabase — `subscribeAnaMessages` (Realtime) após INSERT.
 *
 * @param {boolean} [showFloatingBubbles=true] — Se false, não mostra bolhas (ex.: durante a história).
 * @param {number} [buttonZIndex=3] — z-index do botão fixo (ex.: acima da vista livro).
 * @param {boolean} [showFixedButton=true] — Se false, esconde o botão (ex.: vista livro já mostra o chat).
 */
export function AnaMessagesOverlay({
  showFloatingBubbles = true,
  buttonZIndex = 3,
  showFixedButton = true,
}) {
  const [entries, setEntries] = useState([]);
  const [optimisticRow, setOptimisticRow] = useState(null);
  const [anaModalOpen, setAnaModalOpen] = useState(false);
  const anaLoadSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const seq = ++anaLoadSeqRef.current;
    const load = () => {
      loadAnaMessages()
        .then((rows) => {
          if (cancelled || seq !== anaLoadSeqRef.current) return;
          setEntries(rows);
        })
        .catch(() => {
          if (cancelled || seq !== anaLoadSeqRef.current) return;
          setEntries([]);
        });
    };
    load();
    const unsub = subscribeAnaMessages(load);
    return () => {
      cancelled = true;
      anaLoadSeqRef.current += 1;
      unsub();
    };
  }, []);

  const anaEntries = useMemo(
    () => mergeOptimisticEntries(entries, optimisticRow),
    [entries, optimisticRow],
  );

  return (
    <>
      {showFloatingBubbles ? (
        <FloatingChatBubbles entries={anaEntries} />
      ) : null}
      {showFixedButton ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAnaModalOpen(true);
          }}
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: "max(20px, env(safe-area-inset-bottom))",
            zIndex: buttonZIndex,
            padding: "14px 20px",
            borderRadius: 16,
            border: "1px solid rgba(255,210,140,0.5)",
            background:
              "linear-gradient(165deg, rgba(55,38,32,0.97) 0%, rgba(28,22,18,0.98) 100%)",
            color: "#ffe8c8",
            fontFamily: "monospace",
            fontSize: "clamp(11px, 3.2vw, 14px)",
            fontWeight: 600,
            letterSpacing: "0.03em",
            lineHeight: 1.35,
            cursor: "pointer",
            boxShadow:
              "0 8px 28px rgba(0,0,0,0.5), 0 0 24px rgba(255, 190, 120, 0.12)",
            maxWidth: "min(340px, calc(100vw - 32px))",
            pointerEvents: "auto",
          }}
        >
          Deixa um carinho pra Ana 💛
          <span style={{ display: "block", fontSize: "0.88em", fontWeight: 500, opacity: 0.88, marginTop: 4 }}>
            foto + mensagem — ela vai amar
          </span>
        </button>
      ) : null}
      <AnaMessageModal
        open={anaModalOpen}
        onClose={() => setAnaModalOpen(false)}
        onSubmitStart={({ text, photoDataUrl }) => {
          setOptimisticRow({
            id: `optimistic-${Date.now()}`,
            text,
            photo: photoDataUrl,
            at: Date.now(),
          });
        }}
        onSubmitEnd={() => setOptimisticRow(null)}
        onSaved={async () => {
          try {
            const rows = await loadAnaMessages();
            setEntries(rows);
          } catch {
            /* mantém lista atual */
          }
        }}
      />
    </>
  );
}
