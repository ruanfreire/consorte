/**
 * Firebase Data Connect: `subscribe` na query `ListAnaMessages`.
 * @see https://firebase.google.com/docs/data-connect/web-sdk
 */
import { useEffect, useState } from "react";
import { queryRef, subscribe } from "firebase/data-connect";
import { isLocalHost } from "../config.js";
import { normalizeAnaMessageRow } from "../anaMessagesStorage.js";
import { getDataConnectInstance } from "../dataConnectClient.js";

const LIMIT = 80;

export function useAnaMessagesRealtime(enabled) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setEntries([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const dc = getDataConnectInstance();
    if (!dc) {
      setError(new Error("Data Connect não inicializado."));
      setLoading(false);
      return undefined;
    }

    const ref = queryRef(dc, "ListAnaMessages", { limit: LIMIT });

    const unsub = subscribe(
      ref,
      (res) => {
        try {
          const list = res?.data?.anaMessages ?? [];
          setEntries(list.map((r) => normalizeAnaMessageRow(r)));
          setError(null);
        } catch (e) {
          setError(e);
        }
        setLoading(false);
      },
      (err) => {
        if (isLocalHost() && err) {
          console.warn("[consorte] subscribe ListAnaMessages:", err);
        }
        setError(err ?? new Error("Data Connect"));
        setLoading(false);
      },
    );

    return () => {
      unsub();
    };
  }, [enabled]);

  return {
    entries,
    loading,
    error,
    fromCache: false,
  };
}
