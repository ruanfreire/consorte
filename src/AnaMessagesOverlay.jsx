import { useEffect, useRef, useState } from "react";
import { AnaMessageModal } from "./AnaMessageModal.jsx";
import { FloatingChatBubbles } from "./FloatingChatBubbles.jsx";
import { hasSharedMessages, loadAnaMessages } from "./anaMessagesStorage.js";

/**
 * Botão fixo + bolhas + modal para mensagens à Ana (história ou ecrã de countdown).
 */
export function AnaMessagesOverlay() {
  const [anaEntries, setAnaEntries] = useState([]);
  const [anaModalOpen, setAnaModalOpen] = useState(false);
  const anaLoadSeqRef = useRef(0);

  useEffect(() => {
    const seq = ++anaLoadSeqRef.current;
    loadAnaMessages()
      .then((rows) => {
        const stale = seq !== anaLoadSeqRef.current;
        if (stale) return;
        setAnaEntries(rows);
      })
      .catch(() => {
        if (seq !== anaLoadSeqRef.current) return;
        setAnaEntries([]);
      });
    return () => {
      anaLoadSeqRef.current += 1;
    };
  }, [anaModalOpen]);

  useEffect(() => {
    if (!hasSharedMessages()) return undefined;
    const id = setInterval(() => {
      loadAnaMessages().then(setAnaEntries).catch(() => {});
    }, 28000);
    return () => clearInterval(id);
  }, []);

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
        }}
      >
        DEIXE UMA MENSAGEM PARA A ANA
      </button>
      <AnaMessageModal
        open={anaModalOpen}
        onClose={() => setAnaModalOpen(false)}
        onSaved={async () => {
          try {
            const rows = await loadAnaMessages();
            setAnaEntries(rows);
          } catch {
            /* mantém lista atual */
          }
        }}
      />
    </>
  );
}
