import { useEffect, useRef, useState } from "react";
import {
  getFullscreenElement,
  isIOS,
  isStandalonePWA,
  requestFullscreenBestEffort,
} from "./fullscreen.js";
import {
  allowUltimaPreviewFromConfig,
  getViteConfig,
  isDeployedProduction,
  isLocalHost,
} from "./config.js";
import { AnaMessagesOverlay } from "./AnaMessagesOverlay.jsx";
import { FloatingParty } from "./FloatingParty.jsx";
import { getStepImages } from "./storyImages.js";

const ASSET_BASE = import.meta.env.BASE_URL;

/** Só com `?ultima=1` — em localhost ou com `VITE_PREVIEW_ULTIMA` em `config.js`. */
function allowUltimaPreview() {
  return allowUltimaPreviewFromConfig();
}

function readUltimaQuery() {
  if (typeof window === "undefined") return false;
  return new URL(window.location.href).searchParams.get("ultima") === "1";
}

/** Localhost: `?countdown=1` força o ecrã de contagem (requer `VITE_LAUNCH_AT` no futuro). */
function readCountdownPreviewQuery() {
  if (typeof window === "undefined") return false;
  return new URL(window.location.href).searchParams.get("countdown") === "1";
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

/** Contagem regressiva só no site publicado (não em localhost); `npm run dev` em localhost ignora. */
function useProductionCountdown() {
  const endMs = parseLaunchEndMs(getViteConfig("VITE_LAUNCH_AT"));
  const [now, setNow] = useState(() => Date.now());

  const active =
    isDeployedProduction() && endMs != null && now < endMs;

  useEffect(() => {
    if (!isDeployedProduction() || endMs == null) return;
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
        background:
          "radial-gradient(ellipse 120% 80% at 50% 20%, rgba(90, 40, 55, 0.55) 0%, transparent 55%), radial-gradient(ellipse 100% 60% at 50% 100%, rgba(120, 70, 30, 0.35) 0%, transparent 50%), linear-gradient(180deg, #0d0608 0%, #000 45%, #070506 100%)",
        color: "#fff",
        fontFamily: "monospace",
        textAlign: "center",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <FloatingParty count={36} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          pointerEvents: "none",
          maxWidth: "min(420px, 92vw)",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontSize: "clamp(15px, 4vw, 20px)",
            fontWeight: 600,
            color: "#ffd8a8",
            letterSpacing: "0.02em",
            lineHeight: 1.35,
          }}
        >
          Quase lá… o coração já conta os segundos 💛
        </p>
        <p
          style={{
            margin: "0 0 20px",
            opacity: 0.88,
            fontSize: "clamp(12px, 3.2vw, 14px)",
            color: "#e8c4b5",
            lineHeight: 1.45,
          }}
        >
          Depois disto, uma história feita com calma e com amor — promessa de gente grande 🫶
        </p>
        <p style={{ margin: "0 0 12px", opacity: 0.75, fontSize: "clamp(11px, 3vw, 13px)", color: "#c9a89a" }}>
          Falta pouco para abrir
        </p>
        <p
          className="countdown-digits"
          style={{
            margin: 0,
            fontSize: "clamp(1.5rem, 8vw, 2.6rem)",
            letterSpacing: "0.08em",
            fontVariantNumeric: "tabular-nums",
            color: "#fff5e8",
            textShadow: "0 0 28px rgba(255, 200, 120, 0.35), 0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          {days > 0 ? `${days}d ` : ""}
          {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </p>
        <p
          style={{
            margin: "18px 0 0",
            fontSize: "clamp(11px, 2.8vw, 13px)",
            color: "#9a7d72",
            fontStyle: "italic",
          }}
        >
          Até já — a ansiedade boa também é amor ✨
        </p>
      </div>
      <style>{`
        @keyframes countdownGlow {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50% { opacity: 0.95; filter: brightness(1.06); }
        }
        .countdown-digits {
          animation: countdownGlow 3.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .countdown-digits { animation: none; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <AnaMessagesOverlay />
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

  const musicRef = useRef(null);
  const typeRef = useRef(null);
  const intervalRef = useRef(null);
  const holdTimer = useRef(null);

  const charDelayMs = isLocalHost() ? 20 : 85;

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
      if (isLocalHost()) {
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

      <AnaMessagesOverlay showFloatingBubbles={false} />

      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          position: "relative",
          zIndex: 2,
          paddingBottom:
            "max(96px, calc(env(safe-area-inset-bottom) + 80px))",
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
          <p style={{ marginTop: 20, color: "#c9a896", fontSize: "clamp(12px, 3.2vw, 14px)" }}>
            toca na tela para continuar — devagar também é carinho 👆💛
          </p>
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
  const launchEndMs = parseLaunchEndMs(getViteConfig("VITE_LAUNCH_AT"));

  const devCountdownPreview =
    isLocalHost() &&
    readCountdownPreviewQuery() &&
    launchEndMs != null &&
    Date.now() < launchEndMs;

  const [devNowMs, setDevNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!devCountdownPreview) return;
    const id = setInterval(() => setDevNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [devCountdownPreview]);

  if (active) {
    return <ProductionCountdownScreen endMs={endMs} nowMs={now} />;
  }

  if (devCountdownPreview) {
    return (
      <ProductionCountdownScreen endMs={launchEndMs} nowMs={devNowMs} />
    );
  }

  return <StoryExperience />;
}
