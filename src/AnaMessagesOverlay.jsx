import { useEffect, useMemo, useRef, useState } from "react";
import { AnaMessageModal } from "./AnaMessageModal.jsx";
import { FloatingChatBubbles } from "./FloatingChatBubbles.jsx";
import { loadAnaMessages, subscribeAnaMessages } from "./anaMessagesStorage.js";

/** Junta entrada otimista à lista; evita duplicar quando o SQLite já devolveu o registo. */
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
 * Persistência: SQLite (sql.js) + IndexedDB — `subscribeAnaMessages` após cada INSERT.
 */
export function AnaMessagesOverlay() {
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
      <FloatingChatBubbles entries={anaEntries} />
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
          zIndex: 3,
          padding: "14px 18px",
          borderRadius: 14,
          border: "1px solid rgba(255,200,100,0.45)",
          background: "rgba(35,30,20,0.95)",
          color: "#ffe8b8",
          fontFamily: "monospace",
          fontSize: "clamp(11px, 3.2vw, 14px)",
          fontWeight: 600,
          letterSpacing: "0.04em",
          cursor: "pointer",
          boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
          maxWidth: "calc(100vw - 32px)",
          pointerEvents: "auto",
        }}
      >
        DEIXE UMA MENSAGEM PARA A ANA
      </button>
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
