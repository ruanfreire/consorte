/**
 * Única fonte de configuração (sem ficheiros .env).
 * Data Connect: alinhar `dataconnect/dataconnect.yaml` (serviceId, location) e o connector.
 * @see https://firebase.google.com/codelabs/firebase-dataconnect-web?hl=pt-br
 */

export const MOCK_CONFIG = {
  VITE_FIREBASE_API_KEY: "AIzaSyBepsujqWiZW67b_OmFV9gil6iqGmt5bMc",
  VITE_FIREBASE_AUTH_DOMAIN: "consorte-cf03f.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "consorte-cf03f",
  VITE_FIREBASE_STORAGE_BUCKET: "consorte-cf03f.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "825958372832",
  VITE_FIREBASE_APP_ID: "1:825958372832:web:ba9a548e5abcc9e1344785",
  /** Mesmo `serviceId` que em `dataconnect/dataconnect.yaml` */
  VITE_DATACONNECT_SERVICE_ID: "consorte-service",
  /** Mesmo `connectorId` que em `dataconnect/ana-connector/connector.yaml` */
  VITE_DATACONNECT_CONNECTOR: "ana-connector",
  VITE_DATACONNECT_LOCATION: "us-central1",
  /** Em localhost: usar emulador Data Connect (porta 9399) — `firebase emulators` */
  VITE_USE_DATACONNECT_EMULATOR: "false",
  VITE_USE_MOCK: "false",
  VITE_LAUNCH_AT: "2026-04-03T19:00:00-03:00",
  VITE_PUBLIC_SITE_URL: "https://ruanfreire.github.io/consorte",
  VITE_PREVIEW_ULTIMA: "",
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

export function getFirebaseEnv() {
  return {
    apiKey: String(MOCK_CONFIG.VITE_FIREBASE_API_KEY ?? "").trim(),
    authDomain: String(MOCK_CONFIG.VITE_FIREBASE_AUTH_DOMAIN ?? "").trim(),
    projectId: String(MOCK_CONFIG.VITE_FIREBASE_PROJECT_ID ?? "").trim(),
    storageBucket: String(MOCK_CONFIG.VITE_FIREBASE_STORAGE_BUCKET ?? "").trim(),
    messagingSenderId: String(MOCK_CONFIG.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "").trim(),
    appId: String(MOCK_CONFIG.VITE_FIREBASE_APP_ID ?? "").trim(),
  };
}

export function isFirebaseClientConfigured() {
  const e = getFirebaseEnv();
  return (
    e.apiKey.length > 0 &&
    e.authDomain.length > 0 &&
    e.projectId.length > 0 &&
    e.storageBucket.length > 0 &&
    e.messagingSenderId.length > 0 &&
    e.appId.length > 0
  );
}

export function getDataConnectConnectorConfig() {
  return {
    service: String(MOCK_CONFIG.VITE_DATACONNECT_SERVICE_ID ?? "").trim(),
    connector: String(MOCK_CONFIG.VITE_DATACONNECT_CONNECTOR ?? "").trim(),
    location: String(MOCK_CONFIG.VITE_DATACONNECT_LOCATION ?? "").trim(),
  };
}

export function useDataConnectEmulator() {
  const v = MOCK_CONFIG.VITE_USE_DATACONNECT_EMULATOR;
  return v === "true" || v === "1";
}

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
