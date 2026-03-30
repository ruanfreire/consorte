import { useEffect, useRef, useState } from "react";
import { addAnaMessage, MAX_MESSAGE_CHARS } from "./anaMessagesStorage.js";
import { isLocalHost } from "./config.js";
import { AVATAR_OUTPUT_PX, fileToSmallRoundAvatarDataUrl } from "./imageCrop.js";

/** Quanto tempo o ecrã de sucesso fica visível antes de fechar o modal (ms). */
const SUCCESS_SCREEN_MS = 3200;

/**
 * @param {(payload: { text: string; photoDataUrl: string }) => void} [onSubmitStart]
 *   Chamado após validação local e **antes** de `addAnaMessage` — p.ex. UI otimista.
 * @param {() => void} [onSubmitEnd]
 *   Chamado no `finally` (sucesso ou erro) para limpar o estado otimista.
 */
export function AnaMessageModal({
  open,
  onClose,
  onSaved,
  onSubmitStart,
  onSubmitEnd,
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  /** Evita duplo envio (duplo clique / Enter) antes do estado `busy` atualizar. */
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setText("");
      setPreview(null);
      setErr("");
      setBusy(false);
      setSuccess(false);
      submitLockRef.current = false;
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!preview) {
      setErr("Escolha uma foto.");
      return;
    }
    if (submitLockRef.current || busy) return;
    const trimmed = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!trimmed) {
      setErr("Escreva uma mensagem.");
      return;
    }
    submitLockRef.current = true;
    setBusy(true);
    onSubmitStart?.({ text: trimmed, photoDataUrl: preview });
    try {
      await addAnaMessage({ text: trimmed, photoDataUrl: preview });
      setSuccess(true);
      await new Promise((r) => setTimeout(r, SUCCESS_SCREEN_MS));
      onClose();
      await onSaved?.();
    } catch (er) {
      const msg =
        typeof er?.message === "string" && er.message.length > 0
          ? er.message
          : "Não foi possível salvar.";
      setErr(msg);
      if (isLocalHost()) {
        console.error("[consorte] falha ao enviar mensagem:", er);
      }
    } finally {
      onSubmitEnd?.();
      submitLockRef.current = false;
      setBusy(false);
    }
  };

  const onPickFile = async (ev) => {
    const f = ev.target.files?.[0];
    setPreview(null);
    setErr("");
    if (!f) return;
    try {
      const dataUrl = await fileToSmallRoundAvatarDataUrl(f);
      setPreview(dataUrl);
    } catch (e) {
      setErr(e.message || "Não foi possível processar a imagem.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ana-msg-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        pointerEvents: "auto",
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
        boxSizing: "border-box",
      }}
      onClick={(e) => e.target === e.currentTarget && !busy && !success && onClose()}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#1a1a1a",
          borderRadius: 16,
          padding: 20,
          border: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              textAlign: "center",
              padding: "24px 8px",
              fontFamily: "monospace",
            }}
          >
            <p style={{ margin: 0, fontSize: 42, lineHeight: 1 }} aria-hidden>
              💛
            </p>
            <p
              style={{
                margin: "16px 0 0",
                fontSize: "clamp(16px, 4vw, 18px)",
                color: "#9e8",
                fontWeight: 600,
              }}
            >
              Mensagem enviada!
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#aaa" }}>
              Obrigado — o teu carinho já faz parte da história.
            </p>
          </div>
        ) : (
          <>
        <h2
          id="ana-msg-title"
          style={{
            margin: "0 0 16px",
            fontSize: "clamp(15px, 4vw, 18px)",
            fontFamily: "monospace",
            color: "#fff",
            lineHeight: 1.3,
          }}
        >
          Mensagem para a Ana
        </h2>
        <p style={{ margin: "0 0 12px", fontSize: 12, opacity: 0.75, color: "#ccc" }}>
          Foto recortada no centro em quadrado, redonda ({AVATAR_OUTPUT_PX}px) — leve. Texto: máximo{" "}
          {MAX_MESSAGE_CHARS} caracteres.
        </p>

        <input
          type="file"
          accept="image/*"
          onChange={onPickFile}
          style={{ marginBottom: 12, fontSize: 13, color: "#ddd" }}
        />
        {preview && (
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
            <img
              src={preview}
              alt=""
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid rgba(255,200,100,0.5)",
              }}
            />
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE_CHARS))}
          maxLength={MAX_MESSAGE_CHARS}
          rows={4}
          placeholder="Escreva aqui…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            marginBottom: 8,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #444",
            background: "#111",
            color: "#fff",
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
            resize: "vertical",
            minHeight: 100,
          }}
        />
        <p style={{ margin: "0 0 12px", fontSize: 11, opacity: 0.6, color: "#aaa", textAlign: "right" }}>
          {text.length}/{MAX_MESSAGE_CHARS}
        </p>

        {err && (
          <p style={{ color: "#f88", fontSize: 13, margin: "0 0 12px" }} role="alert">
            {err}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #555",
              background: "transparent",
              color: "#ccc",
              cursor: busy ? "default" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || !preview || !text.trim()}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background:
                busy || !preview || !text.trim() ? "#444" : "#e8b84a",
              color: "#111",
              fontWeight: 600,
              cursor: busy || !preview ? "default" : "pointer",
            }}
          >
            {busy ? "Salvando…" : "Enviar"}
          </button>
        </div>
          </>
        )}
      </form>
    </div>
  );
}
