/**
 * Única fonte de configuração da app (sem ficheiros .env).
 * URL pública do site (GitHub Pages project page). Sincronizar com `vite.config.js` (meta OG no build).
 */

export const MOCK_CONFIG = {
  VITE_FIREBASE_API_KEY: "AIzaSyBepsujqWiZW67b_OmFV9gil6iqGmt5bMc",
  VITE_FIREBASE_AUTH_DOMAIN: "consorte-cf03f.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "consorte-cf03f",
  VITE_FIREBASE_STORAGE_BUCKET: "consorte-cf03f.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "825958372832",
  VITE_FIREBASE_APP_ID: "1:825958372832:web:ba9a548e5abcc9e1344785",
  VITE_FIRESTORE_DATABASE_ID: "consorte-cf03f-database",
  VITE_USE_MOCK: "false",
  VITE_LAUNCH_AT: "2026-04-03T19:00:00-03:00",
  VITE_PUBLIC_SITE_URL: "https://ruanfreire.github.io/consorte",
  /** Com `?ultima=1`: só ativo se `"true"` ou em localhost. */
  VITE_PREVIEW_ULTIMA: "",
};

/** Desenvolvimento = aberto em localhost (inclui `vite preview` em 127.0.0.1). */
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

/** Build de produção servido fora de localhost (ex.: GitHub Pages). */
export function isDeployedProduction() {
  return !isLocalHost();
}

export function getFirebaseEnv() {
  return {
    apiKey: MOCK_CONFIG.VITE_FIREBASE_API_KEY,
    authDomain: MOCK_CONFIG.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: MOCK_CONFIG.VITE_FIREBASE_PROJECT_ID,
    storageBucket: MOCK_CONFIG.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: MOCK_CONFIG.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: MOCK_CONFIG.VITE_FIREBASE_APP_ID,
    firestoreDatabaseId: MOCK_CONFIG.VITE_FIRESTORE_DATABASE_ID,
  };
}

/**
 * @param {keyof typeof MOCK_CONFIG} key
 */
export function getViteConfig(key) {
  return MOCK_CONFIG[key] ?? "";
}

export function useMockMessages() {
  const v = MOCK_CONFIG.VITE_USE_MOCK;
  return v === "true" || v === "1";
}

export function allowUltimaPreviewFromConfig() {
  return (
    isLocalHost() || MOCK_CONFIG.VITE_PREVIEW_ULTIMA === "true"
  );
}
