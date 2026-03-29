import { useEffect, useMemo, useRef, useState } from "react";
import { AnaMessageModal } from "./AnaMessageModal.jsx";
import { FloatingChatBubbles } from "./FloatingChatBubbles.jsx";
import { hasSharedMessages, loadAnaMessages } from "./anaMessagesStorage.js";
import { isLocalHost } from "./config.js";
import { useAnaMessagesRealtime } from "./hooks/useFirestoreRealtime.js";

/** Junta entrada otimista à lista; evita duplicar quando o `onSnapshot` já trouxe o doc. */
function mergeOptimisticEntries(entries, optimistic) {
  if (!optimistic) return entries;
  const duplicate = entries.some(
    (e) => e.text === optimistic.text && e.photo === optimistic.photo,
  );
  if (duplicate) return entries;
  return [...entries, optimistic];
}

/**
 * Botão fixo + bolhas + modal para mensagens à Ana (história ou ecrã de countdown).
 *
 * Firestore: `useAnaMessagesRealtime` (onSnapshot) — atualização em tempo real sem polling.
 * Mock: `loadAnaMessages` + recarga ao fechar o modal.
 * Otimista: bolha aparece ao enviar; remove-se no `finally` ou dedupe quando o snapshot confirma.
 */
export function AnaMessagesOverlay() {
  const shared = hasSharedMessages();
  const { entries: liveEntries, error: liveError } =
    useAnaMessagesRealtime(shared);

  const [mockEntries, setMockEntries] = useState([]);
  const [optimisticRow, setOptimisticRow] = useState(null);
  const [anaModalOpen, setAnaModalOpen] = useState(false);
  const anaLoadSeqRef = useRef(0);

  useEffect(() => {
    if (shared) return undefined;
    const seq = ++anaLoadSeqRef.current;
    loadAnaMessages()
      .then((rows) => {
        const stale = seq !== anaLoadSeqRef.current;
        if (stale) return;
        setMockEntries(rows);
      })
      .catch(() => {
        if (seq !== anaLoadSeqRef.current) return;
        setMockEntries([]);
      });
    return () => {
      anaLoadSeqRef.current += 1;
    };
  }, [anaModalOpen, shared]);

  useEffect(() => {
    if (isLocalHost() && shared && liveError) {
      console.warn("[consorte] ana_messages listener:", liveError);
    }
  }, [shared, liveError]);

  const baseEntries = shared ? liveEntries : mockEntries;
  const anaEntries = useMemo(
    () => mergeOptimisticEntries(baseEntries, optimisticRow),
    [baseEntries, optimisticRow],
  );

  const devFirestoreHint =
    isLocalHost() &&
    shared &&
    liveError &&
    `${liveError?.code ?? "erro"}: ${liveError?.message ?? String(liveError)}`;

  return (
    <>
      {devFirestoreHint ? (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: "max(8px, env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            maxWidth: "min(520px, calc(100vw - 24px))",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,120,100,0.55)",
            background: "rgba(45,20,18,0.96)",
            color: "#ffc9c0",
            fontFamily: "monospace",
            fontSize: "clamp(10px, 2.8vw, 12px)",
            lineHeight: 1.35,
            boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
          }}
        >
          [dev] Firestore listener: {devFirestoreHint}
        </div>
      ) : null}
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
          if (shared) return;
          try {
            const rows = await loadAnaMessages();
            setMockEntries(rows);
          } catch {
            /* mantém lista atual */
          }
        }}
      />
    </>
  );
}
