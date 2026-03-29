/**
 * Firestore modular + React: mesma `Query` que `getDocs` em `loadAnaMessages`.
 * @see https://firebase.google.com/docs/firestore/query-data/listen?hl=pt-br
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "../firebaseDb.js";
import { isLocalHost } from "../config.js";
import {
  anaMessageRowsFromQuerySnapshot,
  buildAnaMessagesQuery,
} from "../anaMessagesStorage.js";

/**
 * Listener genérico Firestore (modular v9): um snapshot por query.
 *
 * - `buildQuery(db)` deve ser estável (useCallback com deps corretas) para não
 *   re-subscrever em cada render.
 * - `mapSnapshot` transforma QuerySnapshot → dados para o estado.
 * - Cleanup: unsubscribe no unmount ou quando `enabled` / query mudam.
 *
 * Offline: o SDK sincroniza quando a rede voltar; `snapshot.metadata.fromCache`
 * indica se a leitura veio de cache local.
 *
 * @param {(db: import("firebase/firestore").Firestore) => import("firebase/firestore").Query} buildQuery
 * @param {(snap: import("firebase/firestore").QuerySnapshot) => unknown} mapSnapshot
 * @param {boolean} enabled
 */
export function useFirestoreSnapshot(buildQuery, mapSnapshot, enabled) {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setData(undefined);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const db = getFirestoreDb();
    if (!db) {
      setError(new Error("Firestore não inicializado."));
      setLoading(false);
      return undefined;
    }

    let q;
    try {
      q = buildQuery(db);
    } catch (e) {
      setError(e);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let devSnapshotLogged = false;
    const unsub = onSnapshot(
      q,
      (snap) => {
        try {
          setData(mapSnapshot(snap));
          setFromCache(snap.metadata.fromCache);
          setError(null);
          if (isLocalHost() && !devSnapshotLogged) {
            devSnapshotLogged = true;
            console.info("[consorte] Firestore snapshot (1.ª leitura)", {
              docs: snap.docs.length,
              fromCache: snap.metadata.fromCache,
              hasPendingWrites: snap.metadata.hasPendingWrites,
            });
          }
        } catch (mapErr) {
          console.warn("[useFirestoreSnapshot] mapSnapshot:", mapErr);
          setError(mapErr);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("[useFirestoreSnapshot] onSnapshot erro:", err?.code, err?.message);
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsub();
    };
  }, [enabled, buildQuery, mapSnapshot]);

  return { data, loading, error, fromCache };
}

/**
 * Mensagens `ana_messages` em tempo real (mesma query que `loadAnaMessages`).
 * Evita polling; a UI atualiza quando há writes (locais ou remotos).
 */
export function useAnaMessagesRealtime(enabled) {
  const buildQuery = useCallback((db) => buildAnaMessagesQuery(db), []);

  const mapSnapshot = useCallback(
    (snap) => anaMessageRowsFromQuerySnapshot(snap),
    [],
  );

  const { data, loading, error, fromCache } = useFirestoreSnapshot(
    buildQuery,
    mapSnapshot,
    enabled,
  );

  const entries = useMemo(() => data ?? [], [data]);

  return { entries, loading, error, fromCache };
}
