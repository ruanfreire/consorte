/**
 * Cliente Firebase (browser): uma única app por página.
 */
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
} from "firebase/firestore";
import { getFirebaseEnv, isLocalHost } from "./config.js";

/** Objeto Web do Firebase Console (Project settings → Your apps). */
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

let _db = null;

/**
 * Uma única instância `FirebaseApp`. Usa `getApps()[0]` se já existir (mais fiável que
 * `getApp()` em cenários com HMR / ordem de imports).
 */
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

/** Base Firestore nomeada na Consola; omitir = `(default)`. */
function firestoreDatabaseId() {
  const id = getFirebaseEnv().firestoreDatabaseId;
  return id.trim().length > 0 ? id.trim() : undefined;
}

/** Instância Firestore ou null se não configurado. */
export function getFirestoreDb() {
  if (!isFirebaseClientConfigured()) return null;
  if (_db) return _db;
  const app = getFirebaseApp();
  if (!app) return null;
  const dbId = firestoreDatabaseId();
  const settings = {
    experimentalAutoDetectLongPolling: true,
    localCache: memoryLocalCache(),
  };
  try {
    _db = dbId
      ? initializeFirestore(app, settings, dbId)
      : initializeFirestore(app, settings);
  } catch {
    _db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
  if (isLocalHost()) {
    const e = getFirebaseEnv();
    console.info("[consorte] Firestore ligado (cache em memória, sem IndexedDB)", {
      projectId: e.projectId,
      databaseId: dbId ?? "(default)",
    });
    console.info(
      "[consorte] Os documentos vê-se em: Consola Firebase → Build → Firestore Database (não em Data Connect).",
    );
  }
  return _db;
}
