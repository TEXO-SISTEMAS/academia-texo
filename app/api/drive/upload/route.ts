import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { PassThrough } from "stream";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const driveServiceAccount = process.env.DRIVE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.DRIVE_SERVICE_ACCOUNT_JSON) : null;

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const SHARED_DRIVE_ID = "0AOIl1AbCEbVfUk9PVA";

function getAuthClient() {
  return new google.auth.GoogleAuth({ credentials: driveServiceAccount, scopes: SCOPES });
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

    console.log("[drive/upload] Archivo recibido:", file?.name, "| tamaño:", file?.size, "| tipo:", file?.type);
    console.log("[drive/upload] courseTitle:", courseTitle);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const auth = getAuthClient();
    const drive = google.drive({ version: "v3", auth });

    // Buscar o crear subcarpeta del curso en el Shared Drive
    console.log("[drive/upload] Buscando carpeta:", courseTitle, "en", ROOT_FOLDER_ID);
    let folderId = await findFolder(drive, courseTitle, ROOT_FOLDER_ID);
    if (!folderId) {
      console.log("[drive/upload] Carpeta no encontrada, creando...");
      folderId = await createFolder(drive, courseTitle, ROOT_FOLDER_ID);
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

    // Hacer público (anyone with link can view)
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });

    console.log("[drive/upload] Permisos públicos establecidos.");

    const directLink = `https://drive.google.com/file/d/${fileId}/preview`;
    console.log("[drive/upload] OK — directLink:", directLink);

    return NextResponse.json({ fileId, webViewLink, directLink });
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



