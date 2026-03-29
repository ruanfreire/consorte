import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/** Objeto Web do Firebase Console (Project settings → Your apps). */
export function isFirebaseClientConfigured() {
  const e = import.meta.env;
  return (
    typeof e.VITE_FIREBASE_API_KEY === "string" &&
    e.VITE_FIREBASE_API_KEY.length > 0 &&
    typeof e.VITE_FIREBASE_AUTH_DOMAIN === "string" &&
    e.VITE_FIREBASE_AUTH_DOMAIN.length > 0 &&
    typeof e.VITE_FIREBASE_PROJECT_ID === "string" &&
    e.VITE_FIREBASE_PROJECT_ID.length > 0 &&
    typeof e.VITE_FIREBASE_STORAGE_BUCKET === "string" &&
    e.VITE_FIREBASE_STORAGE_BUCKET.length > 0 &&
    typeof e.VITE_FIREBASE_MESSAGING_SENDER_ID === "string" &&
    e.VITE_FIREBASE_MESSAGING_SENDER_ID.length > 0 &&
    typeof e.VITE_FIREBASE_APP_ID === "string" &&
    e.VITE_FIREBASE_APP_ID.length > 0
  );
}

let _db = null;

/** Instância Firestore ou null se não configurado. */
export function getFirestoreDb() {
  if (!isFirebaseClientConfigured()) return null;
  if (_db) return _db;
  const e = import.meta.env;
  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          apiKey: e.VITE_FIREBASE_API_KEY,
          authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: e.VITE_FIREBASE_PROJECT_ID,
          storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: e.VITE_FIREBASE_APP_ID,
        });
  _db = getFirestore(app);
  return _db;
}
