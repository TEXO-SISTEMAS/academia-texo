/**
 * cleanup-drive-converted.ts
 * Elimina archivos "_converted" y PDFs duplicados del Drive del service account
 * que quedaron de conversiones anteriores fallidas.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/cleanup-drive-converted.ts
 */

import { google } from "googleapis";

const driveServiceAccount = require("../service-account-drive.json");
const driveAuth = new google.auth.GoogleAuth({
  credentials: driveServiceAccount,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth: driveAuth });

async function main() {
  console.log("Buscando archivos _converted en Drive...\n");

  const res = await drive.files.list({
    q: `name contains '_converted' and trashed = false`,
    fields: "files(id, name, mimeType, size)",
    pageSize: 100,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const files = res.data.files ?? [];
  console.log(`Encontrados: ${files.length} archivos\n`);

  for (const file of files) {
    console.log(`Eliminando: ${file.name} (${file.id})`);
    try {
      await drive.files.delete({ fileId: file.id!, supportsAllDrives: true });
      console.log(`  ✓ Eliminado`);
    } catch (err) {
      console.error(`  ✗ Error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // También vaciar papelera del service account
  console.log("\nVaciando papelera...");
  try {
    await drive.files.emptyTrash();
    console.log("✓ Papelera vaciada");
  } catch (err) {
    console.log("(sin papelera que vaciar)");
  }

  console.log("\nListo.");
}

main().catch(console.error);
