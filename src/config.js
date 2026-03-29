/**
 * Única fonte de configuração (sem ficheiros .env).
 * Mensagens à Ana: se `VITE_MESSAGES_API_URL` estiver preenchido, usa a API PHP+MySQL;
 * caso contrário, SQLite no browser (`sql.js` + IndexedDB).
 */

export const MOCK_CONFIG = {
  VITE_USE_MOCK: "false",
  VITE_LAUNCH_AT: "2026-04-03T19:00:00-03:00",
  VITE_PUBLIC_SITE_URL: "https://ruanfreire.github.io/consorte",
  VITE_PREVIEW_ULTIMA: "",
  /**
   * API PHP+MySQL. Abrir este URL na barra do navegador mostra JSON — isso não usa CORS.
   * Já um `fetch` a partir do GitHub Pages ou de outro domínio exige cabeçalhos CORS no PHP.
   */
  VITE_MESSAGES_API_URL: "https://consorte.fwh.is/messages.php",
  /**
   * Só em `npm run dev`. `"true"` = usa proxy Vite `/api/messages` (evita CORS em localhost).
   * `"false"` = só SQLite local.
   */
  VITE_DEV_USE_REMOTE_MESSAGES_API: "true",
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

/**
 * URL da API PHP (`messages.php`), ou string vazia se usar só SQLite no browser.
 * Em dev: só chama a API se `VITE_DEV_USE_REMOTE_MESSAGES_API` for `"true"` (via proxy `/api/messages`).
 * Em produção: usa sempre `VITE_MESSAGES_API_URL`.
 */
export function getMessagesApiUrl() {
  const raw = String(MOCK_CONFIG.VITE_MESSAGES_API_URL ?? "").trim();
  if (!raw) return "";
  if (import.meta.env.DEV) {
    const useRemote =
      MOCK_CONFIG.VITE_DEV_USE_REMOTE_MESSAGES_API === "true" ||
      MOCK_CONFIG.VITE_DEV_USE_REMOTE_MESSAGES_API === "1";
    if (!useRemote) return "";
    return raw.startsWith("http") ? "/api/messages" : raw;
  }
  return raw;
}

export function useMockMessages() {
  const v = MOCK_CONFIG.VITE_USE_MOCK;
  return v === "true" || v === "1";
}

export function allowUltimaPreviewFromConfig() {
  return isLocalHost() || MOCK_CONFIG.VITE_PREVIEW_ULTIMA === "true";
}
