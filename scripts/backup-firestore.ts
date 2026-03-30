/**
 * backup-firestore.ts
 *
 * Exporta TODA la data de Firestore a un archivo JSON con timestamp.
 * Incluye todas las subcolecciones conocidas del proyecto.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/backup-firestore.ts
 *
 * El backup se guarda en /backups/backup-YYYY-MM-DD_HH-MM-SS.json
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// ─── Inicialización ──────────────────────────────────────────────────────────

const serviceAccount = require("../service-account-firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ─── Tipos ───────────────────────────────────────────────────────────────────

type DocData = Record<string, unknown>;
type CollectionExport = Record<string, DocData & { _subcollections?: Record<string, CollectionExport> }>;
type BackupData = Record<string, CollectionExport>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeTimestamps(data: admin.firestore.DocumentData): DocData {
  const result: DocData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof admin.firestore.Timestamp) {
      result[key] = value.toDate().toISOString();
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = serializeTimestamps(value as admin.firestore.DocumentData);
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function exportCollection(colRef: admin.firestore.CollectionReference): Promise<CollectionExport> {
  const snapshot = await colRef.get();
  const result: CollectionExport = {};

  for (const doc of snapshot.docs) {
    const data = serializeTimestamps(doc.data());
    result[doc.id] = { ...data };

    // Exportar subcolecciones conocidas según la estructura del proyecto
    const subcollections = await doc.ref.listCollections();
    if (subcollections.length > 0) {
      result[doc.id]._subcollections = {};
      for (const subCol of subcollections) {
        result[doc.id]._subcollections![subCol.id] = await exportCollection(subCol);
      }
    }
  }

  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔄 Iniciando backup de Firestore...\n");

  // Colecciones de primer nivel a respaldar
  const rootCollections = [
    "users",
    "allowedUsers",
    "courses",
    "progress",
    "auditLog",
    "loginHistory",
  ];

  const backup: BackupData = {};
  let totalDocs = 0;

  for (const colName of rootCollections) {
    process.stdout.write(`  Exportando /${colName}...`);
    try {
      const colRef = db.collection(colName);
      backup[colName] = await exportCollection(colRef);
      const count = Object.keys(backup[colName]).length;
      totalDocs += count;
      console.log(` ✓ ${count} documentos`);
    } catch (err) {
      console.log(` ✗ ERROR: ${err}`);
    }
  }

  // ── Guardar archivo ──────────────────────────────────────────────────────

  const backupsDir = path.join(__dirname, "../backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, "_")
    .replace(/:/g, "-")
    .replace(/\..+/, "");

  const filename = `backup-${timestamp}.json`;
  const filepath = path.join(backupsDir, filename);

  const output = {
    _meta: {
      exportedAt: now.toISOString(),
      project: serviceAccount.project_id,
      collections: rootCollections,
      totalTopLevelDocs: totalDocs,
    },
    data: backup,
  };

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2), "utf-8");

  const fileSizeKB = Math.round(fs.statSync(filepath).size / 1024);

  console.log(`\n✅ Backup completado`);
  console.log(`   Archivo: backups/${filename}`);
  console.log(`   Tamaño:  ${fileSizeKB} KB`);
  console.log(`   Docs exportados (nivel raíz): ${totalDocs}`);
  console.log(`\n⚠️  Nota: las subcolecciones (chapters, resources, progress/courses/resources)`);
  console.log(`   están anidadas bajo _subcollections en cada documento padre.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error fatal:", err);
    process.exit(1);
  });
