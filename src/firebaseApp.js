/**
 * App Firebase (Web) — necessário para Data Connect e API key do projeto.
 */
import { getApps, initializeApp } from "firebase/app";
import { getFirebaseEnv, isFirebaseClientConfigured } from "./config.js";

export { isFirebaseClientConfigured } from "./config.js";

export function getFirebaseApp() {
  if (!isFirebaseClientConfigured()) return null;
  const apps = getApps();
  if (apps.length > 0) return apps[0];
  const e = getFirebaseEnv();
  return initializeApp({
    apiKey: e.apiKey,
    authDomain: e.authDomain,
    projectId: e.projectId,
    storageBucket: e.storageBucket,
    messagingSenderId: e.messagingSenderId,
    appId: e.appId,
  });
}
