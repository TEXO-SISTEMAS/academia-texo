/**
 * restore-firestore.ts
 * Restaura Firestore desde un archivo JSON generado por backup-firestore.ts.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/restore-firestore.ts backups/firestore-2026-07-17.json
 *
 * Flags opcionales:
 *   --collections users,allowedUsers   solo restaurar esas colecciones
 *   --dry-run                          simular sin escribir nada
 *   --overwrite                        sobreescribir docs existentes (por defecto: skip)
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serviceAccount = require("../service-account-firebase.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Parsear args ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const backupFile = args.find(a => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const overwrite = args.includes("--overwrite");
const collectionsArg = args.find(a => a.startsWith("--collections="))?.split("=")[1]
  ?? args[args.indexOf("--collections") + 1];
const onlyCollections = collectionsArg ? collectionsArg.split(",").map(s => s.trim()) : null;

if (!backupFile) {
  console.error("Uso: npx ts-node scripts/restore-firestore.ts <archivo.json> [--dry-run] [--overwrite] [--collections col1,col2]");
  process.exit(1);
}

const filePath = path.isAbsolute(backupFile)
  ? backupFile
  : path.join(__dirname, "..", backupFile);

if (!fs.existsSync(filePath)) {
  console.error(`Archivo no encontrado: ${filePath}`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSubcollectionKey(key: string) {
  return key.startsWith("__");
}

function toFirestoreValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(toFirestoreValue);

  const obj = value as Record<string, unknown>;

  // Detectar Timestamp serializado: { _seconds: N, _nanoseconds: N }
  if (typeof obj._seconds === "number" && typeof obj._nanoseconds === "number") {
    return new admin.firestore.Timestamp(obj._seconds, obj._nanoseconds);
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!isSubcollectionKey(k)) {
      result[k] = toFirestoreValue(v);
    }
  }
  return result;
}

let totalRestored = 0;
let totalSkipped = 0;
let totalErrors = 0;

async function restoreCollection(
  colPath: string,
  docs: Record<string, unknown>,
  depth = 0
): Promise<void> {
  const indent = "  ".repeat(depth);

  for (const [docId, rawDoc] of Object.entries(docs)) {
    const docRef = db.doc(`${colPath}/${docId}`);

    // Separar datos del documento de las subcolecciones
    const rawData = rawDoc as Record<string, unknown>;
    const docData: Record<string, unknown> = {};
    const subcols: Record<string, Record<string, unknown>> = {};

    for (const [key, val] of Object.entries(rawData)) {
      if (isSubcollectionKey(key)) {
        subcols[key.slice(2)] = val as Record<string, unknown>; // quitar "__"
      } else {
        docData[key] = toFirestoreValue(val);
      }
    }

    // Comprobar si ya existe
    if (!overwrite) {
      try {
        const existing = await docRef.get();
        if (existing.exists) {
          console.log(`${indent}⏭  Skip (ya existe): ${colPath}/${docId}`);
          totalSkipped++;
          // Igual restaurar subcolecciones
          for (const [subId, subDocs] of Object.entries(subcols)) {
            await restoreCollection(`${colPath}/${docId}/${subId}`, subDocs, depth + 1);
          }
          continue;
        }
      } catch {
        // Si falla la lectura, intentar escribir igual
      }
    }

    if (dryRun) {
      console.log(`${indent}[DRY] set ${colPath}/${docId}`);
      totalRestored++;
    } else {
      try {
        await docRef.set(docData, overwrite ? {} : { merge: false });
        console.log(`${indent}✅ ${colPath}/${docId}`);
        totalRestored++;
      } catch (err) {
        console.error(`${indent}❌ Error en ${colPath}/${docId}: ${err instanceof Error ? err.message : err}`);
        totalErrors++;
      }
    }

    // Restaurar subcolecciones
    for (const [subId, subDocs] of Object.entries(subcols)) {
      await restoreCollection(`${colPath}/${docId}/${subId}`, subDocs, depth + 1);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function restore() {
  console.log(`\n📂 Archivo: ${filePath}`);
  if (dryRun) console.log("⚠️  DRY RUN — no se escribirá nada\n");
  if (overwrite) console.log("⚠️  OVERWRITE — se sobreescriben docs existentes\n");

  const raw = fs.readFileSync(filePath, "utf8");
  const backup = JSON.parse(raw) as Record<string, unknown>;

  const meta = backup._meta as { timestamp?: string } | undefined;
  if (meta?.timestamp) console.log(`📅 Backup del: ${meta.timestamp}\n`);

  const collections = Object.keys(backup).filter(k => k !== "_meta");
  const toRestore = onlyCollections
    ? collections.filter(c => onlyCollections.includes(c))
    : collections;

  console.log(`Colecciones a restaurar: ${toRestore.join(", ")}\n`);

  for (const col of toRestore) {
    const docs = backup[col] as Record<string, unknown>;
    const count = Object.keys(docs).length;
    console.log(`\n── /${col} (${count} docs raíz) ──`);
    await restoreCollection(col, docs);
  }

  console.log(`\n✅ Listo.`);
  console.log(`   Restaurados: ${totalRestored}`);
  console.log(`   Saltados:    ${totalSkipped}`);
  if (totalErrors > 0) console.log(`   Errores:     ${totalErrors}`);
  process.exit(0);
}

restore().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
