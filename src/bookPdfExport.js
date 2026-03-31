import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/** ISO 216 A4 em mm (retrato). */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/** Um só tom de papel creme (alinhado ao miolo do livro na app). */
const PAPER_RGB = [253, 251, 242];
const PAPER_HEX = "#fdfbf2";

/**
 * No clone: fundo plano no mesmo tom — remove gradientes, sombras e imagens de fundo.
 */
function applyFlatPaperToClone(clonedSheet) {
  if (!(clonedSheet instanceof HTMLElement)) return;
  const structural = new Set(["DIV", "SECTION", "ARTICLE", "FOOTER", "HEADER", "MAIN", "ASIDE", "NAV"]);

  const apply = (el) => {
    if (!(el instanceof HTMLElement)) return;
    el.style.backgroundImage = "none";
    el.style.boxShadow = "none";
    if (structural.has(el.tagName)) {
      el.style.backgroundColor = PAPER_HEX;
    }
  };

  apply(clonedSheet);
  clonedSheet.style.borderColor = "rgba(0,0,0,0.06)";
  clonedSheet.querySelectorAll("*").forEach(apply);
}

/**
 * Capitular em `<span.book-drop-cap-char>`: reforço só no clone (PDF mais legível).
 */
function applyPdfDropCapBoost(clonedDoc) {
  if (!clonedDoc || typeof clonedDoc.createElement !== "function") return;
  const style = clonedDoc.createElement("style");
  style.setAttribute("data-book-pdf-dropcap", "1");
  style.textContent = `
    .book-drop-cap-char {
      font-size: 2.65em !important;
      line-height: 1 !important;
    }
  `;
  const head = clonedDoc.head;
  if (head) {
    head.appendChild(style);
  } else {
    clonedDoc.documentElement?.appendChild(style);
  }
}

/**
 * Transparência no canvas → leitores de PDF mostram branco.
 */
function flattenCanvasToOpaque(canvas, fill = PAPER_HEX) {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/**
 * Redimensiona para proporção exata 210:297 (A4), evitando barras ao esticar no PDF.
 */
function scaleCanvasToExactA4Ratio(src) {
  const w = 2480;
  const h = Math.round((w * A4_HEIGHT_MM) / A4_WIDTH_MM);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return src;
  ctx.fillStyle = PAPER_HEX;
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return out;
}

async function waitNextPaint() {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/**
 * Gera um PDF: uma página A4 por folha `.book-a4-sheet`.
 * Remove elementos `.book-pdf-exclude` dentro da folha (ex.: botão de download na capa).
 */
export async function exportBookSheetsToPdf(root, filename = "nossa-historia.pdf") {
  if (typeof window === "undefined" || !root) {
    throw new Error("Exportação indisponível.");
  }
  const sheets = root.querySelectorAll(".book-a4-sheet");
  if (!sheets.length) {
    throw new Error("Nenhuma folha do livro encontrada.");
  }

  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }
  await waitNextPaint();

  const pdf = new jsPDF({
    unit: "mm",
    orientation: "portrait",
    format: "a4",
    compress: true,
  });

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];

    const raw = await html2canvas(sheet, {
      scale: 4,
      useCORS: true,
      logging: false,
      backgroundColor: PAPER_HEX,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc, clonedSheet) => {
        if (!(clonedSheet instanceof HTMLElement)) return;
        clonedSheet.querySelectorAll(".book-pdf-exclude").forEach((el) => el.remove());
        clonedSheet.style.overflow = "hidden";
        clonedSheet.style.boxSizing = "border-box";
        applyFlatPaperToClone(clonedSheet);
        applyPdfDropCapBoost(clonedDoc);
      },
    });

    const flat = flattenCanvasToOpaque(raw, PAPER_HEX);
    const a4Canvas = scaleCanvasToExactA4Ratio(flat);
    const imgData = a4Canvas.toDataURL("image/png", 1.0);

    if (i === 0) {
      pdf.deletePage(1);
      pdf.addPage([A4_WIDTH_MM, A4_HEIGHT_MM], "portrait");
    } else {
      pdf.addPage([A4_WIDTH_MM, A4_HEIGHT_MM], "portrait");
    }

    const pageNum = pdf.getNumberOfPages();
    pdf.setPage(pageNum);
    pdf.setFillColor(PAPER_RGB[0], PAPER_RGB[1], PAPER_RGB[2]);
    pdf.rect(0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, "F");
    pdf.addImage(imgData, "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
  }

  pdf.save(filename);
}
