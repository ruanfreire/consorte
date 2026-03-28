import { useEffect, useRef, useState } from "react";
import {
  getFullscreenElement,
  isIOS,
  isStandalonePWA,
  requestFullscreenBestEffort,
} from "./fullscreen.js";
import { AnaMessageModal } from "./AnaMessageModal.jsx";
import { FloatingChatBubbles } from "./FloatingChatBubbles.jsx";
import { FloatingParty } from "./FloatingParty.jsx";
import {
  hasSharedMessages,
  loadAnaMessages,
} from "./anaMessagesStorage.js";
import { getStepImages } from "./storyImages.js";

const ASSET_BASE = import.meta.env.BASE_URL;

/** Só com `?ultima=1` — dev ou build com VITE_PREVIEW_ULTIMA=true (ver env.example.txt). */
function allowUltimaPreview() {
  return (
    import.meta.env.DEV || import.meta.env.VITE_PREVIEW_ULTIMA === "true"
  );
}

function readUltimaQuery() {
  if (typeof window === "undefined") return false;
  return new URL(window.location.href).searchParams.get("ultima") === "1";
}

function StoryImage({ config }) {
  const [hidden, setHidden] = useState(false);
  if (!config || hidden) return null;
  const isGif =
    config.kind === "gif" ||
    /\.gif(\?|$)/i.test(config.src) ||
    /giphy\.com\//i.test(config.src);
  return (
    <img
      src={config.src}
      alt={config.alt ?? ""}
      onError={() => setHidden(true)}
      loading="lazy"
      decoding="async"
      style={{
        marginTop: 20,
        borderRadius: 12,
        maxHeight: isGif ? "min(52vh, 360px)" : "min(48vh, 320px)",
        maxWidth: "min(92vw, 420px)",
        width: "auto",
        height: "auto",
        objectFit: "contain",
        display: "block",
        marginLeft: "auto",
        marginRight: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    />
  );
}

function parseLaunchEndMs(raw) {
  if (!raw || typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

/** Contagem regressiva só no build de produção; `npm run dev` ignora VITE_LAUNCH_AT. */
function useProductionCountdown() {
  const endMs = parseLaunchEndMs(import.meta.env.VITE_LAUNCH_AT);
  const [now, setNow] = useState(() => Date.now());

  const active =
    import.meta.env.PROD && endMs != null && now < endMs;

  useEffect(() => {
    if (!import.meta.env.PROD || endMs == null) return;
    if (Date.now() >= endMs) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= endMs) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [endMs]);

  return { active, endMs: endMs ?? 0, now };
}

function formatRemaining(ms) {
  if (ms <= 0) return { days: 0, h: 0, m: 0, s: 0 };
  const totalS = Math.floor(ms / 1000);
  const days = Math.floor(totalS / 86400);
  const h = Math.floor((totalS % 86400) / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  return { days, h, m, s };
}

function ProductionCountdownScreen({ endMs, nowMs }) {
  const left = endMs - nowMs;
  const { days, h, m, s } = formatRemaining(left);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))",
        background: "#000",
        color: "#fff",
        fontFamily: "monospace",
        textAlign: "center",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <FloatingParty count={32} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <p style={{ margin: "0 0 16px", opacity: 0.85, fontSize: "clamp(13px, 3.5vw, 16px)" }}>
          A história abre em
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "clamp(1.4rem, 7vw, 2.4rem)",
            letterSpacing: "0.06em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {days > 0 ? `${days}d ` : ""}
          {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}

function StoryExperience() {
  const messages = [
    "toque na tela e entre nessa história 💛✨🐻",
    "a gente não se encontrou 🫣",
    "a gente se reconheceu 🧠✨💫",
    "no meio de tanta conversa vazia 🫠",
    "tinha alguma coisa ali 👀💛",
    "não era comum 😳",
    "não era raso 🌊❌",
    "era diferente ✨🫶",
    "eu pedi 20 dias ⏳🥹",
    "não foi distância 🚫📏",
    "foi escolha 🧠💛",
    "foi porque eu quis te entender 🫶",
    "não só te viver rápido ⚡",
    "e você ficou 🫠💛🫶",
    "e isso disse muito mais 🥹",
    "porque hoje em dia… 😶",
    "ficar é raro 🫠",
    "no meio disso tudo 🌍✨",
    "a gente criou um mundo nosso 🐻💛",
    "com eitaaaaa 😂🔥",
    "com porrrrraaaaaaaan 🤣💥",
    "com tápora lagartixa 🦎💀😂",
    "e isso… 🥹",
    "isso é intimidade de verdade 💛",
    "eu não me apaixonei só por você 🫶",
    "eu me apaixonei por como você pensa 🧠💫",
    "pela forma que você se posiciona 👑",
    "pela forma que você não se diminui 🔥",
    "pela forma que você sustenta outras mulheres 👑💛",
    "pela forma que você cria espaço pra elas existirem 🌱✨",
    "isso não é detalhe ❌",
    "isso é quem você é 💛",
    "e eu vejo isso 👀",
    "e eu admiro isso 🫶",
    "e eu sinto orgulho disso ❤️🔥",
    "orgulho da mulher que você é 👑💛",
    "orgulho da pessoa que você é 🫠",
    "e do jeito que você cuida de mim 🥹💛",

    "mas hoje… não é um dia qualquer 🎂✨",
    "hoje é o seu dia 💛🥹",
    "o dia da mulher incrível que você é 👑",
    "o dia da sua existência nesse mundo 🌍✨",
    "que sorte a minha de viver isso com você 🫶",

    "essa história é pequena agora 🫣",
    "mas o que ela é ✨",
    "e o que ela vai ser 🚀",
    "é gigante 🌌💛",
    "ela é movimento 💫",
    "e hoje… eu celebro você 🎉🎂💛",
    "e eu escolhi ficar 🫶",
    "PARABÉNS E EU TE AMO <3 💛🐻✨",
  ];

  const shouldStartAtUltima =
    typeof window !== "undefined" &&
    allowUltimaPreview() &&
    readUltimaQuery();

  const [step, setStep] = useState(() =>
    shouldStartAtUltima ? messages.length - 1 : 0,
  );
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [inFullscreen, setInFullscreen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [anaEntries, setAnaEntries] = useState([]);
  const [anaModalOpen, setAnaModalOpen] = useState(false);

  const musicRef = useRef(null);
  const typeRef = useRef(null);
  const intervalRef = useRef(null);
  const holdTimer = useRef(null);
  /** Invalida loads em voo (Strict Mode / sair da última tela). */
  const anaLoadSeqRef = useRef(0);

  const charDelayMs = import.meta.env.DEV ? 20 : 85;

  useEffect(() => {
    if (allowUltimaPreview() && readUltimaQuery() && step === messages.length - 1) {
      setText(messages[step]);
      setTyping(false);
      return () => clearInterval(intervalRef.current);
    }

    let i = 0;
    setText("");
    setTyping(true);

    const current = messages[step];

    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      if (i < current.length) {
        const char = current[i];

        setText(current.slice(0, i + 1));

        if (typeRef.current && char !== " ") {
          const a = typeRef.current;
          if (a.readyState >= 2) a.currentTime = 0;
          a.play().catch(() => {});
        }

        i++;
      } else {
        clearInterval(intervalRef.current);
        setTyping(false);
      }
    }, charDelayMs);

    return () => clearInterval(intervalRef.current);
  }, [step, charDelayMs]);

  useEffect(() => {
    setStandalone(isStandalonePWA());
    setInFullscreen(!!getFullscreenElement());
  }, []);

  useEffect(() => {
    const sync = () => {
      setInFullscreen(!!getFullscreenElement());
      if (getFullscreenElement()) setIosHelp(false);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  const isLastStep = step === messages.length - 1;

  useEffect(() => {
    if (!isLastStep) return;
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
  }, [isLastStep, anaModalOpen]);

  useEffect(() => {
    if (!isLastStep || !hasSharedMessages()) return undefined;
    const id = setInterval(() => {
      loadAnaMessages().then(setAnaEntries).catch(() => {});
    }, 28000);
    return () => clearInterval(id);
  }, [isLastStep]);

  const showFullscreenBanner =
    !standalone && !inFullscreen && !bannerDismissed;

  const enterFullscreen = async (e) => {
    e.stopPropagation();
    await requestFullscreenBestEffort();
    await new Promise((r) => setTimeout(r, 150));
    const fs = !!getFullscreenElement();
    setInFullscreen(fs);
    if (fs) {
      setIosHelp(false);
      return;
    }
    if (isIOS()) setIosHelp(true);
  };

  const dismissFullscreenBanner = (e) => {
    e.stopPropagation();
    setBannerDismissed(true);
    setIosHelp(false);
  };

  const next = () => {
    if (typing) {
      if (import.meta.env.DEV) {
        clearInterval(intervalRef.current);
        setText(messages[step]);
        setTyping(false);
        return;
      }
      return;
    }

    if (musicRef.current && musicRef.current.paused) {
      musicRef.current.volume = 0.25;
      musicRef.current.play().catch(() => {});
    }

    if (step < messages.length - 1) {
      setStep((s) => s + 1);
    }
  };

  const restart = (e) => {
    e.stopPropagation();
    setAnaModalOpen(false);
    setStep(0);
  };

  const holdStart = () => {
    holdTimer.current = setTimeout(() => {
      alert("🐻💛 você é a coisa mais linda desse mundo todo");
    }, 1200);
  };

  const holdEnd = () => clearTimeout(holdTimer.current);

  const stepImages = getStepImages(ASSET_BASE);

  return (
    <div
      onClick={next}
      onTouchStart={holdStart}
      onTouchEnd={holdEnd}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "black",
        color: "white",
        textAlign: "center",
        padding:
          "max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))",
        fontFamily: "monospace",
        cursor: "pointer",
        overflow: "hidden",
        boxSizing: "border-box",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {showFullscreenBanner && (
        <div
          role="region"
          aria-label="Tela cheia"
          style={{
            position: "fixed",
            top: "max(12px, env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            maxWidth: "min(560px, calc(100vw - 32px))",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.35)",
            background: "rgba(30,30,30,0.96)",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "clamp(11px, 2.8vw, 14px)",
            lineHeight: 1.45,
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={enterFullscreen}
            style={{
              width: "100%",
              padding: 0,
              border: "none",
              background: "transparent",
              color: "inherit",
              font: "inherit",
              lineHeight: 1.45,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            Consorte Ana Luisa, Para melhor experiencia clique aqui para deixar
            em tela cheia.
          </button>
          {iosHelp && (
            <p
              style={{
                margin: "12px 0 0",
                opacity: 0.92,
                fontSize: "clamp(10px, 2.6vw, 13px)",
              }}
            >
              No iPhone ou iPad o Safari pode não abrir tela cheia da página.
              Toque em{" "}
              <strong style={{ whiteSpace: "nowrap" }}>Compartilhar</strong> →{" "}
              <strong>Adicionar à Tela de Início</strong> e abra pelo ícone —
              aí fica em tela cheia. No Android, use o botão acima ou{" "}
              <strong>Instalar app</strong> no menu do Chrome.
            </p>
          )}
          <button
            type="button"
            onClick={dismissFullscreenBanner}
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(0,0,0,0.35)",
              color: "#ddd",
              font: "inherit",
              fontSize: "clamp(10px, 2.5vw, 12px)",
              cursor: "pointer",
            }}
          >
            Continuar sem tela cheia
          </button>
        </div>
      )}

      {isLastStep && (
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
      )}

      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          position: "relative",
          zIndex: 2,
          paddingBottom: isLastStep
            ? "max(96px, calc(env(safe-area-inset-bottom) + 80px))"
            : undefined,
        }}
      >
        <h1 style={{ lineHeight: 1.4, margin: 0 }}>
          {text}
          {typing && (
            <span className="cursor" style={{ animation: "blink 1s infinite" }}>
              |
            </span>
          )}
        </h1>

        <StoryImage config={stepImages[step]} />

        {step === messages.length - 1 && (
          <button
            type="button"
            onClick={restart}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
            }}
          >
            recomeçar 🔁💛
          </button>
        )}

        {step !== messages.length - 1 && (
          <p style={{ marginTop: 20, opacity: 0.4 }}>(toque na tela) 👆💛</p>
        )}

        <audio
          ref={typeRef}
          src={`${ASSET_BASE}type.mp3`}
          preload="metadata"
        />
        <audio
          ref={musicRef}
          src={`${ASSET_BASE}music.mp3`}
          loop
          preload="metadata"
        />
      </div>
      <style>{`
        @keyframes blink {
          0%, 50%, 100% { opacity: 1; }
          25%, 75% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const { active, endMs, now } = useProductionCountdown();

  if (active) {
    return <ProductionCountdownScreen endMs={endMs} nowMs={now} />;
  }

  return <StoryExperience />;
}
