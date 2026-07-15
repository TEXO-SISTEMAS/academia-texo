/**
 * fix-presentation-pdf.ts
 *
 * Busca todos los recursos de tipo "presentation" que no tienen pdfFileId,
 * convierte el PPTX a PDF usando la Drive API y actualiza Firestore.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/fix-presentation-pdf.ts
 */

import * as admin from "firebase-admin";
import { google } from "googleapis";
import { PassThrough } from "stream";
import * as path from "path";

// ─── Firebase Admin ──────────────────────────────────────────────────────────

const serviceAccount = require("../service-account-firebase.json");
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ─── Google Drive Auth ───────────────────────────────────────────────────────

const driveServiceAccount = require("../service-account-drive.json");
const driveAuth = new google.auth.GoogleAuth({
  credentials: driveServiceAccount,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth: driveAuth });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

async function convertToPdf(fileId: string, fileName: string, parentId: string): Promise<string> {
  // Primero descargamos el PPTX como buffer
  console.log(`  → Descargando PPTX original...`);
  const downloadRes = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  const pptxBuffer = Buffer.from(downloadRes.data as ArrayBuffer);
  console.log(`  → Descargado: ${(pptxBuffer.length / 1024).toFixed(0)} KB`);

  // Importar como Google Slides al My Drive del service account (sin parents = root)
  // Esto evita problemas de cuota en la carpeta destino
  console.log(`  → Importando PPTX como Google Slides (en root del SA)...`);
  const pptxStream = new PassThrough();
  pptxStream.end(pptxBuffer);
  const importRes = await drive.files.create({
    requestBody: {
      name: `${fileName}_converted`,
      mimeType: "application/vnd.google-apps.presentation",
    },
    media: {
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      body: pptxStream,
    },
    fields: "id",
  });
  const googleFileId = importRes.data.id!;

  console.log(`  → Exportando a PDF...`);
  const exportRes = await drive.files.export(
    { fileId: googleFileId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" }
  );
  const pdfBuffer = Buffer.from(exportRes.data as ArrayBuffer);

  // Eliminar archivo intermedio
  await drive.files.delete({ fileId: googleFileId, supportsAllDrives: true }).catch(() => {});

  console.log(`  → Subiendo PDF...`);
  const pdfName = fileName.replace(/\.pptx?$/i, ".pdf");
  const pdfStream = new PassThrough();
  pdfStream.end(pdfBuffer);

  const pdfUploadRes = await drive.files.create({
    requestBody: { name: pdfName, parents: [parentId] },
    media: { mimeType: "application/pdf", body: pdfStream },
    fields: "id",
    supportsAllDrives: true,
  });
  const pdfFileId = (pdfUploadRes as any).data.id as string;

  // Hacer público
  await drive.permissions.create({
    fileId: pdfFileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  });

  return pdfFileId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Buscando presentaciones sin pdfFileId...\n");

  const coursesSnap = await db.collection("courses").get();
  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const courseDoc of coursesSnap.docs) {
    const chaptersSnap = await db
      .collection(`courses/${courseDoc.id}/chapters`)
      .get();

    for (const chapterDoc of chaptersSnap.docs) {
      if (chapterDoc.data().deleted) continue;

      const resourcesSnap = await db
        .collection(`courses/${courseDoc.id}/chapters/${chapterDoc.id}/resources`)
        .get();

      for (const resourceDoc of resourcesSnap.docs) {
        const data = resourceDoc.data();
        if (data.type !== "presentation") continue;
        if (data.deleted) continue;
        if (data.content?.pdfFileId) {
          skipped++;
          continue;
        }

        const driveUrl: string = data.content?.driveUrl ?? "";
        const fileId = extractDriveFileId(driveUrl);
        if (!fileId) {
          console.log(`  [SKIP] ${resourceDoc.id} — no se pudo extraer fileId de: ${driveUrl}`);
          skipped++;
          continue;
        }

        console.log(`[PROCESANDO] Curso: ${courseDoc.data().title} | Recurso: ${data.title}`);
        console.log(`  fileId: ${fileId}`);

        try {
          // Obtener carpeta padre del archivo original
          const fileMeta = await drive.files.get({
            fileId,
            fields: "parents, name",
            supportsAllDrives: true,
          });
          const parentId = fileMeta.data.parents?.[0] ?? process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";
          const fileName = (fileMeta.data.name as string) ?? "presentacion";

          const pdfFileId = await convertToPdf(fileId, fileName, parentId);

          // Actualizar Firestore
          await resourceDoc.ref.update({ "content.pdfFileId": pdfFileId });
          console.log(`  ✓ pdfFileId guardado: ${pdfFileId}\n`);
          fixed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  ✗ ERROR: ${msg}\n`);
          errors++;
        }
      }
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Convertidos: ${fixed}`);
  console.log(`Ya tenían pdfFileId (omitidos): ${skipped}`);
  console.log(`Errores: ${errors}`);
}

main().catch(console.error);
