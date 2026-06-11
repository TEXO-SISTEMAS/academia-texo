import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { PassThrough } from "stream";
import { getDriveAuth } from "@/lib/drive-auth";
import { requireAuth } from "@/lib/api-auth";

const SHARED_DRIVE_ID = "0AOIl1AbCEbVfUk9PVA";

const PPT_MIMES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
];
const DOCX_MIMES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

/**
 * POST /api/drive/convert-pdf
 * Body: { fileId: string, mimeType: string, fileName: string }
 * Convierte un archivo PPT/PPTX/DOC/DOCX a PDF usando Drive API.
 * Retorna: { pdfFileId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const authCheck = await requireAuth(req, { role: "artesano" });
    if (!authCheck.ok) return authCheck.response;

    const { fileId, mimeType, fileName } = await req.json() as {
      fileId: string;
      mimeType: string;
      fileName: string;
    };

    if (!fileId || !mimeType) {
      return NextResponse.json({ error: "fileId y mimeType son requeridos." }, { status: 400 });
    }

    const isPpt  = PPT_MIMES.includes(mimeType);
    const isDocx = DOCX_MIMES.includes(mimeType);

    if (!isPpt && !isDocx) {
      return NextResponse.json({ error: "Tipo de archivo no soportado para conversión." }, { status: 400 });
    }

    const auth  = getDriveAuth();
    const drive = google.drive({ version: "v3", auth: auth as Parameters<typeof google.drive>[0]["auth"] });

    // Obtener la carpeta padre del archivo original
    const fileMeta = await drive.files.get({
      fileId,
      fields: "parents",
      supportsAllDrives: true,
    });
    const parentId = fileMeta.data.parents?.[0] ?? process.env.GOOGLE_DRIVE_FOLDER_ID!;

    const googleMime = isPpt
      ? "application/vnd.google-apps.presentation"
      : "application/vnd.google-apps.document";

    // 1. Copiar a formato Google Docs/Slides (auto-convierte)
    const copyRes = await drive.files.copy({
      fileId,
      requestBody: {
        name:    `${fileName}_converted`,
        mimeType: googleMime,
        parents: [parentId],
      },
      fields: "id",
      supportsAllDrives: true,
    });
    const googleFileId = copyRes.data.id!;

    // 2. Exportar como PDF
    const exportRes = await drive.files.export(
      { fileId: googleFileId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );
    const pdfBuffer = Buffer.from(exportRes.data as ArrayBuffer);

    // 3. Eliminar el archivo Google Docs/Slides intermedio
    await drive.files.delete({ fileId: googleFileId, supportsAllDrives: true }).catch(() => {});

    // 4. Subir el PDF a Drive en la misma carpeta
    const pdfName   = fileName.replace(/\.(docx?|pptx?)$/i, ".pdf");
    const pdfStream = new PassThrough();
    pdfStream.end(pdfBuffer);

    const pdfUploadRes = await drive.files.create({
      requestBody: { name: pdfName, parents: [parentId] },
      media: { mimeType: "application/pdf", body: pdfStream },
      fields: "id",
      supportsAllDrives: true,
    });
    const pdfFileId = (pdfUploadRes as { data: { id: string } }).data.id;

    // 5. Hacer público el PDF
    await drive.permissions.create({
      fileId: pdfFileId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });

    console.log(`[convert-pdf] OK — ${fileName} → pdfFileId: ${pdfFileId}`);

    return NextResponse.json({ pdfFileId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[convert-pdf] ERROR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
