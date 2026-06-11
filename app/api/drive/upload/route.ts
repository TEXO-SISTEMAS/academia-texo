import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { PassThrough } from "stream";
import { requireAuth } from "@/lib/api-auth";

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const SHARED_DRIVE_ID = "0AOIl1AbCEbVfUk9PVA";

function getDriveServiceAccount() {
  const b64 = process.env.DRIVE_SERVICE_ACCOUNT_JSON_B64;
  if (b64) return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const raw = process.env.DRIVE_SERVICE_ACCOUNT_JSON;
  if (raw) return JSON.parse(raw);
  return null;
}

function getAuthClient() {
  return new google.auth.GoogleAuth({ credentials: getDriveServiceAccount(), scopes: SCOPES });
}

/** Busca una subcarpeta por nombre dentro de parentId en el Shared Drive. */
async function findFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string
): Promise<string | null> {
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
    corpora: "drive",
    driveId: SHARED_DRIVE_ID,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

/** Crea una subcarpeta en el Shared Drive y retorna su id. */
async function createFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string
): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
      driveId: SHARED_DRIVE_ID,
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id!;
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await requireAuth(req, { role: "artesano" });
    if (!authCheck.ok) return authCheck.response;

    const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log("[drive/upload] GOOGLE_DRIVE_FOLDER_ID:", ROOT_FOLDER_ID ?? "(no definido)");

    if (!ROOT_FOLDER_ID) {
      return NextResponse.json(
        { error: "Variable de entorno GOOGLE_DRIVE_FOLDER_ID no configurada." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const courseTitle = (formData.get("courseTitle") as string | null) ?? "General";
    const courseId = (formData.get("courseId") as string | null) ?? "";
    const folderName = courseId
      ? `${courseTitle} [${courseId.slice(0, 6)}]`
      : courseTitle;

    console.log("[drive/upload] Archivo recibido:", file?.name, "| tamaño:", file?.size, "| tipo:", file?.type);
    console.log("[drive/upload] courseTitle:", courseTitle, "| courseId:", courseId, "| folderName:", folderName);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const auth = getAuthClient();
    const drive = google.drive({ version: "v3", auth });

    // Buscar o crear subcarpeta del curso en el Shared Drive
    console.log("[drive/upload] Buscando carpeta:", folderName, "en", ROOT_FOLDER_ID);
    let folderId = await findFolder(drive, folderName, ROOT_FOLDER_ID);
    if (!folderId) {
      console.log("[drive/upload] Carpeta no encontrada, creando...");
      folderId = await createFolder(drive, folderName, ROOT_FOLDER_ID);
      console.log("[drive/upload] Carpeta creada:", folderId);
    } else {
      console.log("[drive/upload] Carpeta existente:", folderId);
    }

    // Convertir File → Buffer → PassThrough stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = new PassThrough();
    stream.end(buffer);

    console.log("[drive/upload] Iniciando upload a Shared Drive...");

    // Subir archivo al Shared Drive
    const uploadRes = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [folderId],
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: stream,
      },
      fields: "id,webViewLink",
      supportsAllDrives: true,
    });

    const fileId = uploadRes.data.id;
    const webViewLink = uploadRes.data.webViewLink;

    console.log("[drive/upload] Archivo subido. fileId:", fileId, "webViewLink:", webViewLink);

    if (!fileId) {
      throw new Error("Drive no retornó fileId después del upload.");
    }

    // Hacer público el archivo original
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });

    console.log("[drive/upload] Permisos públicos establecidos.");

    const directLink = `https://drive.google.com/file/d/${fileId}/preview`;

    // ── Conversión automática a PDF para DOCX/DOC/PPT/PPTX ──────────────────
    const DOCX_MIMES = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    const PPT_MIMES = [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
    ];
    const fileMime = file.type || "";
    const isDocx   = DOCX_MIMES.includes(fileMime);
    const isPpt    = PPT_MIMES.includes(fileMime);

    let pdfFileId: string | undefined;

    if (isDocx || isPpt) {
      try {
        console.log("[drive/upload] Convirtiendo a Google format para exportar PDF...");
        const googleMime = isDocx
          ? "application/vnd.google-apps.document"
          : "application/vnd.google-apps.presentation";

        // Copiar el archivo a formato Google Docs/Slides (auto-convierte)
        const copyRes = await drive.files.copy({
          fileId,
          requestBody: {
            name:     `${file.name}_converted`,
            mimeType: googleMime,
            parents:  [folderId],
          },
          fields: "id",
          supportsAllDrives: true,
        });
        const googleFileId = copyRes.data.id!;
        console.log("[drive/upload] Google file creado:", googleFileId);

        // Exportar como PDF
        const exportRes = await drive.files.export(
          { fileId: googleFileId, mimeType: "application/pdf" },
          { responseType: "arraybuffer" }
        );
        const pdfBuffer = Buffer.from(exportRes.data as ArrayBuffer);
        console.log("[drive/upload] PDF exportado, tamaño:", pdfBuffer.length);

        // Eliminar el archivo Google Docs/Slides intermedio
        await drive.files.delete({ fileId: googleFileId, supportsAllDrives: true }).catch(() => {});

        // Subir el PDF a Drive
        const pdfStream = new PassThrough();
        pdfStream.end(pdfBuffer);
        const pdfName = file.name.replace(/\.(docx?|pptx?)$/i, ".pdf");
        const pdfUploadRes = await drive.files.create({
          requestBody: { name: pdfName, parents: [folderId] },
          media: { mimeType: "application/pdf", body: pdfStream },
          fields: "id",
          supportsAllDrives: true,
        });
        pdfFileId = pdfUploadRes.data.id!;
        console.log("[drive/upload] PDF subido, pdfFileId:", pdfFileId);

        // Hacer público el PDF
        await drive.permissions.create({
          fileId: pdfFileId,
          requestBody: { role: "reader", type: "anyone" },
          supportsAllDrives: true,
        });
        console.log("[drive/upload] PDF público OK.");
      } catch (convErr) {
        // La conversión es best-effort — no fallar el upload original
        console.error("[drive/upload] Error al convertir a PDF (no fatal):", convErr);
      }
    }

    console.log("[drive/upload] OK — directLink:", directLink, "pdfFileId:", pdfFileId ?? "none");

    return NextResponse.json({ fileId, webViewLink, directLink, ...(pdfFileId ? { pdfFileId } : {}) });
  } catch (err: unknown) {
    let detail = "Error desconocido";
    if (err instanceof Error) {
      detail = err.message;
      if (err.stack) console.error("[drive/upload] Stack:", err.stack);
    } else if (typeof err === "object" && err !== null) {
      const gErr = err as { message?: string; response?: { data?: unknown; status?: number } };
      detail = gErr.message ?? JSON.stringify(err);
      if (gErr.response) {
        console.error("[drive/upload] Google API response status:", gErr.response.status);
        console.error("[drive/upload] Google API response data:", JSON.stringify(gErr.response.data));
      }
    }

    console.error("[drive/upload] ERROR:", detail);

    return NextResponse.json(
      { error: `Error al subir archivo a Drive: ${detail}` },
      { status: 500 }
    );
  }
}



