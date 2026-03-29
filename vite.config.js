import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { MOCK_CONFIG } from "./src/config.js";

const OG_FILE = "og-cover.jpg";

/** Base do Vite em produção (ex. `/consorte/`) — derivada de `MOCK_CONFIG.VITE_PUBLIC_SITE_URL`. */
function viteBaseFromPublicSiteUrl(mode) {
  if (mode !== "production") return "/";
  const raw = String(MOCK_CONFIG.VITE_PUBLIC_SITE_URL ?? "").trim();
  if (!raw) return "/consorte/";
  try {
    const pathname = new URL(raw.replace(/\/$/, "") + "/").pathname;
    return pathname === "/" ? "/" : pathname;
  } catch {
    return "/consorte/";
  }
}

function readPngDimensions(buf) {
  if (buf.length < 24) return null;
  if (
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    return null;
  }
  if (buf.readUInt32BE(8) !== 13) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1)
    return null;
  return { w, h, mime: "image/png" };
}

function readJpegDimensions(buf) {
  if (buf.length < 10 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  for (let i = 2; i < buf.length - 8; i++) {
    if (buf[i] !== 0xff) continue;
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc3) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      if (w > 0 && h > 0 && w < 65535 && h < 65535)
        return { w, h, mime: "image/jpeg" };
    }
  }
  return null;
}

function readOgCoverMeta() {
  const full = resolve(process.cwd(), "public", OG_FILE);
  const fallback = { w: 1200, h: 630, mime: "image/jpeg" };
  if (!existsSync(full)) return fallback;
  try {
    const buf = readFileSync(full);
    const jpeg = readJpegDimensions(buf);
    if (jpeg) return jpeg;
    const png = readPngDimensions(buf);
    if (png) return png;
    return fallback;
  } catch {
    return fallback;
  }
}

export default defineConfig(({ mode }) => {
  const base = viteBaseFromPublicSiteUrl(mode);
  const publicSite = String(MOCK_CONFIG.VITE_PUBLIC_SITE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  const ogMeta = readOgCoverMeta();

  return {
    base,
    build: { outDir: "docs", emptyOutDir: true },
    plugins: [
      react(),
      {
        name: "html-sharing-meta",
        transformIndexHtml(html) {
          const assetBase = mode === "production" ? base : "/";
          const canonical =
            mode === "production" && publicSite !== ""
              ? `${publicSite}/`
              : "";
          const ogImage =
            mode === "production" && publicSite !== ""
              ? `${publicSite}/${OG_FILE}`
              : "";

          if (mode === "production" && publicSite === "") {
            console.warn(
              "[consorte] Defina `VITE_PUBLIC_SITE_URL` em `src/config.js` (MOCK_CONFIG) para og:url / og:image.",
            );
          }

          let out = html
            .replaceAll("%ASSET_BASE%", assetBase)
            .replaceAll("%CANONICAL_URL%", canonical)
            .replaceAll("%OG_URL%", canonical)
            .replaceAll("%OG_IMAGE_URL%", ogImage)
            .replaceAll("%OG_IMAGE_WIDTH%", String(ogMeta.w))
            .replaceAll("%OG_IMAGE_HEIGHT%", String(ogMeta.h))
            .replaceAll("%OG_IMAGE_TYPE%", ogMeta.mime);

          if (!canonical) {
            out = out.replace(/\s*<link rel="canonical"[^>]*>\s*/g, "\n");
          }
          if (!ogImage) {
            out = out.replace(/\s*<meta property="og:url"[^>]*>\s*/g, "\n");
            out = out.replace(/\s*<meta property="og:image"[^>]*>\s*/g, "\n");
            out = out.replace(
              /\s*<meta property="og:image:secure_url"[^>]*>\s*/g,
              "\n",
            );
            out = out.replace(/\s*<meta property="og:image:type"[^>]*>\s*/g, "\n");
            out = out.replace(
              /\s*<meta property="og:image:width"[^>]*>\s*/g,
              "\n",
            );
            out = out.replace(
              /\s*<meta property="og:image:height"[^>]*>\s*/g,
              "\n",
            );
            out = out.replace(/\s*<meta name="twitter:image"[^>]*>\s*/g, "\n");
            out = out.replace(/\s*<meta name="twitter:url"[^>]*>\s*/g, "\n");
            out = out.replace(
              /\s*<meta name="msapplication-TileImage"[^>]*>\s*/g,
              "\n",
            );
            out = out.replace(/\s*<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/g, "\n");
          }

          return out;
        },
      },
    ],
  };
});
