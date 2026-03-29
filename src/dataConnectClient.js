/**
 * Firebase Data Connect — PostgreSQL (Cloud SQL) via GraphQL gerido.
 * @see https://firebase.google.com/docs/data-connect/web-sdk
 */
import {
  connectDataConnectEmulator,
  getDataConnect,
} from "firebase/data-connect";
import {
  getDataConnectConnectorConfig,
  isLocalHost,
  useDataConnectEmulator,
} from "./config.js";
import { getFirebaseApp } from "./firebaseApp.js";

let _dc = null;

export function getDataConnectInstance() {
  const app = getFirebaseApp();
  const cfg = getDataConnectConnectorConfig();
  if (!app || !cfg.service || !cfg.connector || !cfg.location) return null;
  if (_dc) return _dc;
  _dc = getDataConnect(app, {
    service: cfg.service,
    connector: cfg.connector,
    location: cfg.location,
  });
  if (isLocalHost() && useDataConnectEmulator()) {
    connectDataConnectEmulator(_dc, "localhost", 9399);
  }
  return _dc;
}

export function isDataConnectConfigured() {
  const cfg = getDataConnectConnectorConfig();
  return (
    typeof cfg.service === "string" &&
    cfg.service.length > 0 &&
    typeof cfg.connector === "string" &&
    cfg.connector.length > 0 &&
    typeof cfg.location === "string" &&
    cfg.location.length > 0
  );
}
