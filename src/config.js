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
  /** API PHP+MySQL (mensagens partilhadas em produção). */
  VITE_MESSAGES_API_URL: "https://consorte.fwh.is/messages.php",
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

/** URL da API PHP (`messages.php`), ou string vazia se usar só SQLite no browser. */
export function getMessagesApiUrl() {
  return String(MOCK_CONFIG.VITE_MESSAGES_API_URL ?? "").trim();
}

export function useMockMessages() {
  const v = MOCK_CONFIG.VITE_USE_MOCK;
  return v === "true" || v === "1";
}

export function allowUltimaPreviewFromConfig() {
  return isLocalHost() || MOCK_CONFIG.VITE_PREVIEW_ULTIMA === "true";
}
