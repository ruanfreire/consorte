import { useEffect, useState } from "react";
import { addAnaMessage, MAX_MESSAGE_CHARS } from "./anaMessagesStorage.js";
import { AVATAR_OUTPUT_PX, fileToSmallRoundAvatarDataUrl } from "./imageCrop.js";

export function AnaMessageModal({ open, onClose, onSaved }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setText("");
      setPreview(null);
      setErr("");
      setBusy(false);
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
    setBusy(true);
    try {
      await addAnaMessage({ text, photoDataUrl: preview });
      await onSaved?.();
      onClose();
    } catch (er) {
      setErr(er.message || "Não foi possível salvar.");
    } finally {
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
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
        boxSizing: "border-box",
      }}
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
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
      </form>
    </div>
  );
}
