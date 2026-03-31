import { useEffect, useMemo, useRef, useState } from "react";
import { loadAnaMessages, subscribeAnaMessages } from "./anaMessagesStorage.js";
import { isSupabaseConfigured } from "./config.js";

/** ~caracteres que cabem na área útil de uma folha A4 (história). */
const STORY_CHARS_PER_PAGE = 780;

/**
 * Parte um parágrafo longo em troços que cabem numa página.
 */
function splitParagraphIntoChunks(text, maxChars) {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxChars) return [t];
  const out = [];
  let i = 0;
  while (i < t.length) {
    let end = Math.min(i + maxChars, t.length);
    if (end < t.length) {
      const chunk = t.slice(i, end);
      const sp = chunk.lastIndexOf(" ");
      if (sp > maxChars * 0.45) {
        end = i + sp;
      } else {
        end = i + maxChars;
      }
    }
    const part = t.slice(i, end).trim();
    if (part) out.push(part);
    i = end;
    while (i < t.length && /\s/.test(t[i])) i += 1;
  }
  return out;
}

/**
 * Maiúscula na primeira letra do texto (ignora aspas, espaços e pontuação inicial).
 */
function capitalizeFirstLetter(text) {
  const t = String(text ?? "");
  const match = t.match(/^(\P{L}*)(\p{L})(.*)$/u);
  if (!match) return t;
  return match[1] + match[2].toUpperCase() + match[3];
}

/**
 * Separa prefixo + primeira letra + resto para capitular em `<span>` (raster/PDF fiável).
 */
function splitLeadingLetterForDropCap(text) {
  const t = String(text ?? "");
  const match = t.match(/^(\P{L}*)(\p{L})(.*)$/u);
  if (!match) return null;
  return {
    prefix: match[1],
    letter: match[2].toUpperCase(),
    rest: match[3],
  };
}

/**
 * Distribui os parágrafos da história em várias “páginas” (arrays de parágrafos por folha).
 */
function chunkStoryIntoPages(paragraphs, maxChars) {
  const pieces = [];
  for (const p of paragraphs) {
    pieces.push(...splitParagraphIntoChunks(p, maxChars));
  }
  const pages = [];
  let bucket = [];
  let bucketChars = 0;
  const gap = 28;

  for (const piece of pieces) {
    const gapCost = bucket.length > 0 ? gap : 0;
    if (bucket.length > 0 && bucketChars + gapCost + piece.length > maxChars) {
      pages.push(bucket);
      bucket = [piece];
      bucketChars = piece.length;
    } else {
      bucket.push(piece);
      bucketChars += gapCost + piece.length;
    }
  }
  if (bucket.length) pages.push(bucket);
  return pages;
}

/**
 * Corpo: Cormorant Infant — leitura clara, traço redondo típico de livros infantis antigos.
 * Títulos: Cormorant — editorial clássico.
 */
const BOOK_SERIF = "'Cormorant Infant', Georgia, 'Times New Roman', serif";
const BOOK_DISPLAY = "'Cormorant', 'Cormorant Infant', Georgia, serif";

/** Papel e tinta no estilo livro antigo (creme + carvão, não preto puro). */
const BOOK_PAPER = "#fdfbf2";
const BOOK_INK = "#2c2620";

/**
 * Folhas corridas alternadas, como na edição clássica (verso / recto).
 * Verso = página par (número à esquerda); recto = ímpar (número à direita).
 */
const RUNNING_TITLE_VERSO = "NOSSA HISTÓRIA";
const RUNNING_TITLE_RECTO = "PARA NÓS";

/** Páginas ímpares = recto (número à direita); pares = verso (número à esquerda), como livro impresso. */
function spreadSideForPage(pageNumber) {
  return pageNumber % 2 === 1 ? "right" : "left";
}

/**
 * Folha A4: proporção ISO 210×297 mm; variantes de “papel” (capa / interior / mensagens).
 * `showBookHeader`: cabeçalho tipo livro (folha corrida + número na quina).
 * `footerMode`: "full" = capa com “n · total”; "none" = sem rodapé (número só no topo, como edições clássicas).
 */
function A4Page({
  children,
  pageNumber,
  totalPages,
  variant = "interior",
  showBookHeader = false,
  spreadSide,
  footerMode = "full",
  runningTitleVerso = RUNNING_TITLE_VERSO,
  runningTitleRecto = RUNNING_TITLE_RECTO,
}) {
  const side = spreadSide ?? spreadSideForPage(pageNumber);
  const headLeft = side === "left";
  const runningTitle = headLeft ? runningTitleVerso : runningTitleRecto;

  return (
    <div
      className={`book-a4-sheet book-sheet book-sheet--${variant}`}
      style={{
        flexShrink: 0,
        color: BOOK_INK,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {showBookHeader ? (
        <header
          className={`book-running-head book-running-head--${headLeft ? "left" : "right"}`}
          aria-label={`Página ${pageNumber} de ${totalPages}`}
        >
          <span className="book-running-num">{headLeft ? pageNumber : ""}</span>
          <span className="book-running-title">{runningTitle}</span>
          <span className="book-running-num">{headLeft ? "" : pageNumber}</span>
        </header>
      ) : null}
      <div className={`book-page-inner book-page-inner--${variant}`}>{children}</div>
      {footerMode === "full" ? (
        <footer className="book-page-footer">
          <span className="book-page-footer-inner" aria-label={`Página ${pageNumber} de ${totalPages}`}>
            <span className="book-page-footer-num">{pageNumber}</span>
            <span className="book-page-footer-dot" aria-hidden>
              ·
            </span>
            <span className="book-page-footer-num">{totalPages}</span>
          </span>
        </footer>
      ) : null}
    </div>
  );
}

/**
 * Vista “livro”: história repartida em várias folhas A4; mensagens numa única folha (scroll se não couber). Sem GIFs.
 */
export function StoryBookView({ messages, onClose }) {
  const bookPagesRef = useRef(null);
  const [chatRows, setChatRows] = useState([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [pdfExporting, setPdfExporting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setChatRows([]);
      setChatLoading(false);
      return;
    }
    if (typeof window === "undefined") return;
    const load = () => {
      loadAnaMessages()
        .then((rows) => setChatRows(rows))
        .catch(() => setChatRows([]))
        .finally(() => setChatLoading(false));
    };
    load();
    const unsub = subscribeAnaMessages(load);
    return () => unsub();
  }, []);

  /** Evita faixa clara (fundo do browser / #root) à volta do overlay fixo. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const body = document.body;
    const appRoot = document.getElementById("root");
    const prevHtml = root.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    const prevApp = appRoot?.style.backgroundColor;
    root.style.backgroundColor = "#121110";
    body.style.backgroundColor = "#121110";
    if (appRoot) appRoot.style.backgroundColor = "#121110";
    return () => {
      root.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
      if (appRoot) appRoot.style.backgroundColor = prevApp ?? "";
    };
  }, []);

  const sortedChat = useMemo(() => {
    return [...chatRows].sort((a, b) => a.at - b.at);
  }, [chatRows]);

  const storyPages = useMemo(() => {
    if (!messages?.length) return [];
    return chunkStoryIntoPages(messages, STORY_CHARS_PER_PAGE);
  }, [messages]);

  const pages = useMemo(() => {
    const list = [{ kind: "cover", key: "cover" }, { kind: "index", key: "index" }];
    storyPages.forEach((paragraphs, i) => {
      list.push({
        kind: "story",
        key: `story-${i}`,
        storyPageIndex: i,
        paragraphs,
      });
    });
    list.push({ kind: "chat-all", key: "chat-all" });
    return list;
  }, [storyPages]);

  const totalPages = pages.length;

  /** Números de página estáveis para o índice (capa=1, índice=2, história a partir de 3). */
  const indexPageMap = useMemo(() => {
    const storyStart = 3;
    const storyEnd = 2 + storyPages.length;
    const messagesPage = 3 + storyPages.length;
    return { storyStart, storyEnd, messagesPage };
  }, [storyPages.length]);

  const handleDownloadPdf = async () => {
    if (pdfExporting || !bookPagesRef.current) return;
    setPdfExporting(true);
    try {
      const { exportBookSheetsToPdf } = await import("./bookPdfExport.js");
      await exportBookSheetsToPdf(bookPagesRef.current);
    } catch (e) {
      console.warn("Book PDF export failed", e instanceof Error ? e.message : "unknown");
      window.alert(
        "Não foi possível gerar o PDF. Tenta outra vez; se usas fotos externas, confirma a ligação à internet.",
      );
    } finally {
      setPdfExporting(false);
    }
  };

  return (
    <div
      role="document"
      lang="pt-BR"
      className="book-viewport book-theme"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        maxWidth: "100%",
        minHeight: "100dvh",
        zIndex: 4000,
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        backgroundColor: "#121110",
        backgroundImage:
          "linear-gradient(180deg, #1e1c1a 0%, #121110 50%, #0c0b0a 100%)",
        fontFamily: BOOK_SERIF,
        boxSizing: "border-box",
        padding:
          "max(52px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(100px, calc(env(safe-area-inset-bottom) + 76px)) max(12px, env(safe-area-inset-left))",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "fixed",
          top: "max(10px, env(safe-area-inset-top))",
          left: "max(10px, env(safe-area-inset-left))",
          zIndex: 10,
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,200,100,0.35)",
          background: "rgba(20,16,14,0.94)",
          color: "#ffe8c8",
          fontFamily: "monospace",
          fontSize: "clamp(12px, 3.2vw, 14px)",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}
      >
        ← Voltar
      </button>

      <div
        role="region"
        aria-label="Descarregar o livro"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          padding: "12px 14px max(16px, env(safe-area-inset-bottom))",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(8,6,5,0) 0%, rgba(8,6,5,0.75) 35%, rgba(8,6,5,0.96) 100%)",
        }}
      >
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={pdfExporting}
          aria-busy={pdfExporting}
          aria-label="Baixar o livro em PDF para o teu telemóvel ou computador"
          style={{
            pointerEvents: "auto",
            width: "min(100%, 560px)",
            padding: "14px 20px",
            borderRadius: 14,
            border: "none",
            background: pdfExporting
              ? "linear-gradient(180deg, #8a7a68 0%, #6d5f50 100%)"
              : "linear-gradient(180deg, #e8c878 0%, #c9a030 100%)",
            color: "#1f1a14",
            fontFamily: "system-ui, Segoe UI, sans-serif",
            fontSize: "clamp(15px, 4vw, 17px)",
            fontWeight: 700,
            cursor: pdfExporting ? "wait" : "pointer",
            boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
          }}
        >
          {pdfExporting ? "A preparar o PDF…" : "Baixar livro (PDF)"}
        </button>
      </div>

      <div
        ref={bookPagesRef}
        className="book-pages-root"
        style={{
          maxWidth: "min(580px, 100%)",
          margin: "0 auto",
          paddingTop: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        {pages.map((page, idx) => {
          const n = idx + 1;
          if (page.kind === "cover") {
            return (
              <A4Page key={page.key} pageNumber={n} totalPages={totalPages} variant="cover">
                <div className="book-cover">
                  <p className="book-cover-kicker">Nossa história</p>
                  <h1 className="book-cover-title">Um conto de nós 💛</h1>
                  <p className="book-cover-subtitle">Vira a página e lê com calma.</p>
                  <div className="book-cover-ornament" aria-hidden />
                </div>
              </A4Page>
            );
          }
          if (page.kind === "index") {
            const { storyStart, storyEnd, messagesPage } = indexPageMap;
            const hasStory = storyPages.length > 0;
            const storyPageLabel =
              hasStory && storyPages.length > 1
                ? `${storyStart}–${storyEnd}`
                : hasStory
                  ? String(storyStart)
                  : null;
            return (
              <A4Page
                key={page.key}
                pageNumber={n}
                totalPages={totalPages}
                variant="index"
                showBookHeader
                footerMode="none"
              >
                <div className="book-index">
                  <h2 className="book-index-title">Índice</h2>
                  <p className="book-index-lead">O que há neste livrinho.</p>
                  <ul className="book-index-list">
                    {hasStory ? (
                      <li className="book-index-row">
                        <span className="book-index-label">I. Um conto de nós</span>
                        <span className="book-index-leader" aria-hidden />
                        <span className="book-index-pg">{storyPageLabel}</span>
                      </li>
                    ) : null}
                    <li className="book-index-row">
                      <span className="book-index-label">
                        {hasStory ? "II. " : "I. "}
                        Mensagens do coração
                      </span>
                      <span className="book-index-leader" aria-hidden />
                      <span className="book-index-pg">{messagesPage}</span>
                    </li>
                  </ul>
                </div>
              </A4Page>
            );
          }
          if (page.kind === "story") {
            const paras = page.paragraphs;
            return (
              <A4Page
                key={page.key}
                pageNumber={n}
                totalPages={totalPages}
                variant="interior"
                showBookHeader
                footerMode="none"
              >
                <div
                  className="book-story-block"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "visible",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                  }}
                >
                  {page.storyPageIndex === 0 ? (
                    <div className="book-chapter-head">
                      <p className="book-chapter-roman">I.</p>
                      <h2 className="book-chapter-title">Um conto de nós</h2>
                    </div>
                  ) : null}
                  {page.storyPageIndex > 0 ? (
                    <p className="book-story-continues">Continua…</p>
                  ) : null}
                  {paras.map((paragraph, i) => {
                    const isFirstOfPage = i === 0;
                    if (!isFirstOfPage) {
                      return (
                        <p key={`${page.key}-${i}`} className="book-story-para">
                          {paragraph}
                        </p>
                      );
                    }
                    const capParts = splitLeadingLetterForDropCap(paragraph);
                    if (!capParts) {
                      return (
                        <p key={`${page.key}-${i}`} className="book-story-para book-story-para--open">
                          {capitalizeFirstLetter(paragraph)}
                        </p>
                      );
                    }
                    return (
                      <p key={`${page.key}-${i}`} className="book-story-para book-story-para--open">
                        {capParts.prefix}
                        <span className="book-drop-cap-wrap">
                          <span className="book-drop-cap-char">{capParts.letter}</span>
                        </span>
                        {capParts.rest}
                      </p>
                    );
                  })}
                </div>
              </A4Page>
            );
          }
          if (page.kind === "chat-all") {
            return (
              <A4Page
                key={page.key}
                pageNumber={n}
                totalPages={totalPages}
                variant="messages"
                showBookHeader
                footerMode="none"
              >
                <div
                  className="book-messages-wrap"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <header className="book-messages-header">
                    <h2 className="book-messages-title">Um coração de mensagens</h2>
                    <p className="book-messages-lead">
                      Tudo junto — se não couber na folha, podes rolar com calma.
                    </p>
                  </header>
                  <div
                    className="book-chat-body"
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: "auto",
                      WebkitOverflowScrolling: "touch",
                      paddingRight: 4,
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {chatLoading ? (
                      <p className="book-messages-placeholder">A carregar mensagens…</p>
                    ) : null}
                    {!chatLoading && !isSupabaseConfigured() ? (
                      <p className="book-messages-placeholder">Mensagens indisponíveis neste momento.</p>
                    ) : null}
                    {!chatLoading && isSupabaseConfigured() && sortedChat.length === 0 ? (
                      <p className="book-messages-placeholder">
                        Ainda não há mensagens — o mural espera o primeiro carinho 💛
                      </p>
                    ) : null}
                    {!chatLoading && isSupabaseConfigured() && sortedChat.length > 0
                      ? sortedChat.map((row) => (
                          <article key={row.id} className="book-message-card">
                            <img
                              src={row.photo}
                              alt=""
                              crossOrigin="anonymous"
                              className="book-message-avatar"
                            />
                            <div className="book-message-body">
                              <p className="book-message-text">{row.text}</p>
                              <p className="book-message-date">
                                {new Date(row.at).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </article>
                        ))
                      : null}
                  </div>
                </div>
              </A4Page>
            );
          }
          return null;
        })}
      </div>

      <style>{`
        .book-theme {
          --book-paper: ${BOOK_PAPER};
          --book-ink: ${BOOK_INK};
          --book-ink-muted: #5a4a3e;
          --book-rule: rgba(44, 38, 32, 0.14);
          --book-font-body: ${BOOK_SERIF};
          --book-font-display: ${BOOK_DISPLAY};
        }
        .book-cover-title,
        .book-chapter-title,
        .book-index-title,
        .book-messages-title {
          font-family: var(--book-font-display);
        }
        /* ISO A4 retrato: largura fixa, altura = largura × (297/210) */
        .book-a4-sheet {
          width: min(100%, 560px);
          max-width: min(92vw, 560px);
          margin: 0 auto 32px;
          aspect-ratio: 210 / 297;
          height: auto;
          max-height: none;
          align-self: center;
          color: var(--book-ink);
        }
        @supports not (aspect-ratio: 210 / 297) {
          .book-a4-sheet {
            height: calc(min(92vw, 560px) * 297 / 210);
          }
        }
        .book-pages-root .book-a4-sheet {
          flex-shrink: 0;
        }
        /* Miolo: papel creme uniforme (estilo livro antigo), sem gradiente de “site” */
        .book-sheet {
          border-radius: 2px;
          background: var(--book-paper);
          background-clip: border-box;
          border: 1px solid rgba(55, 48, 40, 0.12);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.65) inset,
            0 10px 36px rgba(0, 0, 0, 0.2),
            0 1px 4px rgba(0, 0, 0, 0.05);
        }
        .book-sheet--cover {
          background: linear-gradient(175deg, #fff9ef 0%, #f3e9d8 48%, #ebe0d0 100%);
          border: 1px solid rgba(55, 48, 40, 0.14);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.75) inset,
            0 14px 38px rgba(0, 0, 0, 0.2);
        }
        .book-sheet--interior,
        .book-sheet--index {
          font-feature-settings: "kern" 1, "liga" 1, "onum" 1;
          font-variant-numeric: oldstyle-nums;
        }
        .book-sheet--index {
          background: var(--book-paper);
        }
        .book-sheet--messages {
          background: var(--book-paper);
        }
        .book-page-inner {
          flex: 1;
          min-height: 0;
          min-width: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          background: transparent;
        }
        /* Cabeçalho: número na quina externa + folha corrida (texto diferente verso/recto) */
        .book-running-head {
          flex-shrink: 0;
          display: grid;
          grid-template-columns: minmax(1.75rem, 1fr) minmax(0, 14rem) minmax(1.75rem, 1fr);
          align-items: baseline;
          gap: 0.35rem;
          padding: 0.45rem clamp(16px, 4.5vw, 26px) 0.5rem;
          border-bottom: 1px solid var(--book-rule);
          background: transparent;
        }
        .book-running-head--left .book-running-num:first-child {
          justify-self: start;
          text-align: left;
        }
        .book-running-head--left .book-running-num:last-child {
          visibility: hidden;
        }
        .book-running-head--right .book-running-num:first-child {
          visibility: hidden;
        }
        .book-running-head--right .book-running-num:last-child {
          justify-self: end;
          text-align: right;
        }
        .book-running-num {
          font-family: var(--book-font-body);
          font-size: 0.74rem;
          font-variant-numeric: lining-nums;
          color: var(--book-ink-muted);
          min-width: 0.6em;
        }
        .book-running-title {
          font-family: var(--book-font-body);
          font-size: clamp(0.54rem, 1.9vw, 0.64rem);
          font-weight: 500;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--book-ink-muted);
          text-align: center;
          line-height: 1.3;
        }
        /* Margens generosas como no livro impresso */
        .book-page-inner--interior {
          padding: clamp(14px, 3.5vw, 22px) clamp(22px, 6vw, 46px) clamp(22px, 5.5vw, 40px)
            clamp(26px, 6.5vw, 48px);
        }
        .book-page-inner--cover {
          padding: clamp(26px, 6.5vw, 44px) clamp(20px, 5vw, 36px);
        }
        .book-page-inner--messages {
          padding: clamp(10px, 2.5vw, 16px) clamp(18px, 5vw, 34px) clamp(16px, 4vw, 26px);
        }
        .book-page-inner--index {
          padding: clamp(14px, 3.5vw, 22px) clamp(22px, 6vw, 44px) clamp(20px, 5vw, 36px)
            clamp(26px, 6.5vw, 48px);
        }
        .book-index {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          max-width: min(100%, 26rem);
          margin: 0 auto;
        }
        .book-index-title {
          margin: 0 0 0.5rem;
          font-size: clamp(1.35rem, 4vw, 1.65rem);
          font-weight: 600;
          letter-spacing: 0.04em;
          text-align: center;
          color: var(--book-ink);
        }
        .book-index-lead {
          margin: 0 0 1.25rem;
          font-family: var(--book-font-body);
          font-size: clamp(0.88rem, 2.8vw, 0.98rem);
          font-style: italic;
          text-align: center;
          color: var(--book-ink-muted);
          line-height: 1.45;
        }
        .book-index-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        .book-index-row {
          display: flex;
          flex-direction: row;
          align-items: baseline;
          gap: 0.35rem;
          width: 100%;
          font-family: var(--book-font-body);
          font-size: clamp(0.95rem, 2.9vw, 1.05rem);
          line-height: 1.35;
          color: var(--book-ink);
        }
        .book-index-label {
          flex-shrink: 0;
          max-width: 72%;
        }
        .book-index-leader {
          flex: 1;
          min-width: 1rem;
          border-bottom: 1px dotted var(--book-rule);
          height: 0;
          margin-bottom: 0.2em;
          align-self: flex-end;
          opacity: 0.85;
        }
        .book-index-pg {
          flex-shrink: 0;
          min-width: 2.75rem;
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }
        .book-page-footer {
          flex-shrink: 0;
          padding: 0.5rem 0.75rem 0.75rem;
          text-align: center;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          background: rgba(0, 0, 0, 0.02);
        }
        .book-page-footer-inner {
          font-family: var(--book-font-body);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          color: #8a7a6e;
        }
        .book-page-footer-dot {
          margin: 0 0.28em;
          opacity: 0.55;
        }
        .book-cover {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          text-align: center;
          gap: 0.85rem;
          width: 100%;
          max-width: min(100%, 22rem);
          margin: 0 auto;
          padding: clamp(1.75rem, 9vmin, 3rem) clamp(1rem, 4vw, 1.5rem) 1rem;
          box-sizing: border-box;
        }
        .book-cover-kicker {
          margin: 0;
          font-family: var(--book-font-body);
          font-size: clamp(0.7rem, 2.4vw, 0.78rem);
          color: var(--book-ink-muted);
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }
        .book-cover-title {
          margin: 0;
          font-size: clamp(1.65rem, 5.4vw, 2.05rem);
          font-weight: 500;
          color: var(--book-ink);
          line-height: 1.18;
          letter-spacing: 0.02em;
          max-width: 14ch;
        }
        .book-cover-subtitle {
          margin: 0;
          font-family: var(--book-font-body);
          font-size: clamp(0.92rem, 2.9vw, 1.02rem);
          font-style: italic;
          color: var(--book-ink-muted);
          line-height: 1.55;
          max-width: 22em;
        }
        .book-cover-ornament {
          width: 2.5rem;
          height: 3px;
          border-radius: 2px;
          background: linear-gradient(90deg, transparent, rgba(180, 140, 90, 0.45), transparent);
          margin: 0.15rem 0 0.25rem;
        }
        /* Coluna estreita e centrada: leitura como livro infantil (não linha larga de site) */
        .book-story-block {
          width: 100%;
          max-width: min(100%, 28rem);
          margin-left: auto;
          margin-right: auto;
        }
        .book-chapter-head {
          text-align: center;
          margin: 0 0 1.15rem;
          padding: 0.2rem 0 0;
        }
        .book-chapter-roman {
          margin: 0 0 0.4rem;
          font-family: var(--book-font-body);
          font-size: clamp(1rem, 3.1vw, 1.15rem);
          font-weight: 500;
          color: var(--book-ink);
        }
        .book-chapter-title {
          margin: 0;
          font-size: clamp(1.12rem, 3.4vw, 1.35rem);
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--book-ink);
          line-height: 1.22;
        }
        .book-story-continues {
          margin: 0 0 1.1rem;
          text-align: center;
          font-family: var(--book-font-body);
          font-size: 0.65rem;
          font-weight: 500;
          font-style: normal;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--book-ink-muted);
        }
        /* Corpo: justificado, recuo só em parágrafos novos (sem espaço extra entre blocos, como impresso) */
        .book-story-para {
          margin: 0;
          padding: 0;
          font-family: var(--book-font-body);
          font-size: clamp(15.5px, 3.6vw, 17.5px);
          line-height: 1.5;
          text-align: justify;
          text-align-last: left;
          text-wrap: pretty;
          hyphens: auto;
          -webkit-hyphens: auto;
          hyphenate-limit-chars: 6 3 3;
          color: var(--book-ink);
          max-width: 100%;
        }
        .book-story-para + .book-story-para {
          text-indent: 1.75em;
        }
        .book-story-para--open {
          font-size: clamp(15.5px, 3.6vw, 17.5px);
          line-height: 1.5;
          overflow: visible;
        }
        .book-drop-cap-wrap {
          float: left;
          display: flex;
          align-items: flex-end;
          height: 1.5em;
          width: max-content;
          margin: 0 0.02em 0 0;
          overflow: visible;
        }
        .book-drop-cap-char {
          font-family: var(--book-font-body);
          font-size: 2.65em;
          line-height: 1;
          font-weight: 700;
          color: var(--book-ink);
          text-transform: uppercase;
          display: block;
        }
        .book-story-para--open::after {
          content: "";
          display: table;
          clear: both;
        }
        .book-story-para:last-child {
          margin-bottom: 0;
        }
        .book-messages-header {
          flex-shrink: 0;
          text-align: center;
          padding-bottom: 0.55rem;
          margin-bottom: 0.2rem;
          border-bottom: 1px solid var(--book-rule);
        }
        .book-messages-title {
          margin: 0 0 0.4rem;
          font-size: clamp(1.12rem, 3.4vw, 1.32rem);
          font-weight: 500;
          letter-spacing: 0.02em;
          color: var(--book-ink);
          line-height: 1.25;
        }
        .book-messages-lead {
          margin: 0 auto;
          max-width: 28em;
          font-family: var(--book-font-body);
          font-size: clamp(0.72rem, 2.5vw, 0.82rem);
          color: var(--book-ink-muted);
          line-height: 1.5;
        }
        .book-messages-placeholder {
          margin: 0;
          text-align: center;
          font-family: var(--book-font-body);
          font-size: 0.92rem;
          color: var(--book-ink-muted);
          line-height: 1.55;
        }
        .book-chat-body {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
        }
        .book-message-card {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.75rem 0.85rem;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.06);
        }
        .book-message-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          border: 2px solid rgba(200, 175, 140, 0.45);
        }
        .book-message-body {
          min-width: 0;
          flex: 1;
        }
        .book-message-text {
          margin: 0;
          font-family: var(--book-font-body);
          font-size: clamp(14px, 3.4vw, 15px);
          line-height: 1.5;
          color: var(--book-ink);
          text-align: justify;
          text-align-last: left;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .book-message-date {
          margin: 0.45rem 0 0;
          font-family: var(--book-font-body);
          font-size: 0.68rem;
          color: var(--book-ink-muted);
        }
        @media print {
          .book-a4-sheet {
            width: 210mm !important;
            height: 297mm !important;
            max-width: 210mm !important;
            aspect-ratio: 210 / 297 !important;
            break-after: page;
            page-break-after: always;
            box-shadow: none !important;
            margin: 0 auto 12px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .book-a4-sheet { transition: none; }
        }
        .book-viewport {
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }
      `}</style>
    </div>
  );
}
