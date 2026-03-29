/**
 * Única fonte de configuração da app (inclui ligação ao Supabase).
 * A chave publicável é exposta no bundle do browser (normal para Supabase + RLS).
 */

export const MOCK_CONFIG = {
  VITE_USE_MOCK: "false",
  VITE_LAUNCH_AT: "2026-04-03T19:00:00-03:00",
  VITE_PUBLIC_SITE_URL: "https://ruanfreire.github.io/consorte",
  VITE_PREVIEW_ULTIMA: "",

  /** Supabase — projeto (URL + chave publicável/anónima). */
  VITE_SUPABASE_URL: "https://yneutghdrmvkspzoqvum.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
    "sb_publishable_YtgmFQoIACtxLsRRuJ_ofg_FFgIDm5E",
};

export function isLocalHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h.endsWith(".localhost")
  );
}

export function isDeployedProduction() {
  return !isLocalHost();
}

export function getViteConfig(key) {
  return MOCK_CONFIG[key] ?? "";
}

/** Supabase com URL e chave preenchidas em `MOCK_CONFIG`. */
export function isSupabaseConfigured() {
  const u = String(MOCK_CONFIG.VITE_SUPABASE_URL ?? "").trim();
  const k = String(MOCK_CONFIG.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? "").trim();
  return u.length > 0 && k.length > 0;
}

export function useMockMessages() {
  const v = MOCK_CONFIG.VITE_USE_MOCK;
  return v === "true" || v === "1";
}

export function allowUltimaPreviewFromConfig() {
  return isLocalHost() || MOCK_CONFIG.VITE_PREVIEW_ULTIMA === "true";
}
