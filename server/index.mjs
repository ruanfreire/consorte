/**
 * API para mensagens da Ana — use só no servidor (Render, Railway, VPS).
 * Variável: MONGODB_URI (nunca no front React).
 */
import "dotenv/config";
import cors from "cors";
import express from "express";
import { randomUUID } from "crypto";
import { MongoClient } from "mongodb";

const MAX_TEXT = 300;
const MAX_PHOTO = 200_000;

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI ausente.");
  process.exit(1);
}

const DB_NAME = "consorte";
const COLLECTION = "ana_messages";

const client = new MongoClient(uri);
let ready = false;

async function collection() {
  if (!ready) {
    await client.connect();
    ready = true;
  }
  return client.db(DB_NAME).collection(COLLECTION);
}

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || true,
    maxAge: 86400,
  }),
);
app.use(express.json({ limit: "650kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/messages", async (_req, res) => {
  try {
    const col = await collection();
    const rows = await col
      .find({})
      .sort({ at: 1 })
      .limit(80)
      .toArray();
    const out = rows.map((d) => ({
      id: String(d._id),
      text: d.text,
      photo: d.photo,
      at: typeof d.at === "number" ? d.at : Number(d.at),
    }));
    res.json(out);
  } catch (e) {
    console.error("[messages:list]", e.message);
    res.status(500).json({ error: "Erro ao listar mensagens." });
  }
});

app.post("/api/messages", async (req, res) => {
  try {
    const text = String(req.body?.text ?? "")
      .trim()
      .slice(0, MAX_TEXT);
    const photo = String(req.body?.photo ?? "");
    if (!text) {
      return res.status(400).json({ error: "Mensagem vazia." });
    }
    if (!photo.startsWith("data:image/")) {
      return res.status(400).json({ error: "Foto inválida." });
    }
    if (photo.length > MAX_PHOTO) {
      return res.status(400).json({ error: "Foto muito grande." });
    }
    const at = Date.now();
    const id = randomUUID();
    const col = await collection();
    await col.insertOne({ _id: id, text, photo, at });
    res.status(201).json({ id, text, photo, at });
  } catch (e) {
    console.error("[messages:insert]", e.message);
    res.status(500).json({ error: "Erro ao salvar." });
  }
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`consorte-api em http://localhost:${port}`);
});
