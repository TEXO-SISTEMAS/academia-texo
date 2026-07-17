/**
 * backup-firestore.ts
 * Exporta todas las colecciones de Firestore a JSON.
 * Usado por GitHub Actions para backup diario.
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64;
if (!b64) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_JSON_B64");
const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function exportCollection(colPath: string): Promise<Record<string, unknown>> {
  const snap = await db.collection(colPath).get();
  const result: Record<string, unknown> = {};
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const subcols = await docSnap.ref.listCollections();
    const entry: Record<string, unknown> = { ...data };
    for (const sub of subcols) {
      entry[`__${sub.id}`] = await exportCollection(sub.path);
    }
    result[docSnap.id] = entry;
  }
  return result;
}

async function backup() {
  const COLLECTIONS = ["users", "allowedUsers", "courses", "progress", "auditLog", "loginHistory"];
  console.log("Iniciando backup...\n");

  const out: Record<string, unknown> = {
    _meta: { timestamp: new Date().toISOString() },
  };

  for (const col of COLLECTIONS) {
    process.stdout.write(`  Exportando /${col}...`);
    try {
      out[col] = await exportCollection(col);
      console.log(` ✅ ${Object.keys(out[col] as object).length} docs`);
    } catch (err) {
      console.log(` ❌ ${err instanceof Error ? err.message : err}`);
    }
  }

  const outDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(outDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const outFile = path.join(outDir, `firestore-${date}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n✅ Guardado: backups/firestore-${date}.json`);

  // Mantener solo los últimos 30 backups
  const files = fs.readdirSync(outDir)
    .filter(f => f.startsWith("firestore-") && f.endsWith(".json"))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - 30))) {
    fs.unlinkSync(path.join(outDir, f));
    console.log(`Eliminado backup viejo: ${f}`);
  }

  process.exit(0);
}

backup().catch(err => { console.error(err); process.exit(1); });
