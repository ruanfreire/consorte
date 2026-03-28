/**
 * Cria índices na coleção. Rode uma vez com MONGODB_URI no ambiente:
 *   cd server && npm install && npm run init-db
 * Não commite .env — use Atlas → Database Access + Network Access (0.0.0.0/0 para testes).
 */
import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Defina MONGODB_URI (string de conexão do Atlas).");
  process.exit(1);
}

const DB_NAME = "consorte";
const COLLECTION = "ana_messages";

const client = new MongoClient(uri);

try {
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);
  await col.createIndex({ at: 1 });
  console.log(`OK: índice em ${DB_NAME}.${COLLECTION} (at)`);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await client.close();
}
