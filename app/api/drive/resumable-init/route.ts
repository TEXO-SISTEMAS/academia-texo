import { NextRequest, NextResponse } from "next/server";

const SHARED_DRIVE_ID = "0AOIl1AbCEbVfUk9PVA";

async function getAccessToken(): Promise<string> {
  const bodyParams = new URLSearchParams({
    client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID     ?? "",
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "",
    grant_type:    "refresh_token",
  });

  console.log("[resumable-init] client_id length:", (process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").length);
  console.log("[resumable-init] secret length:", (process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").length);
  console.log("[resumable-init] refresh length:", (process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "").length);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyParams,
  });

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
  console.log("[resumable-init] token response:", res.status, data.error ?? "OK");
  if (!data.access_token) {
    throw new Error(`Error obteniendo access_token: ${data.error} — ${data.error_description}`);
  }
  return data.access_token;
}

async function findOrCreateFolder(accessToken: string, name: string, parentId: string): Promise<string> {
  // Buscar carpeta existente
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`
  );
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive&corpora=drive&driveId=${SHARED_DRIVE_ID}&includeItemsFromAllDrives=true&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json() as { files?: { id: string }[] };
  if (listData.files?.[0]?.id) return listData.files[0].id;

  // Crear carpeta
  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
        driveId: SHARED_DRIVE_ID,
      }),
    }
  );
  const createData = await createRes.json() as { id?: string };
  if (!createData.id) throw new Error("No se pudo crear la carpeta en Drive");
  return createData.id;
}

export async function POST(req: NextRequest) {
  try {
    const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!ROOT_FOLDER_ID) {
      return NextResponse.json({ error: "GOOGLE_DRIVE_FOLDER_ID no configurado" }, { status: 500 });
    }

    const { fileName, mimeType, fileSize, courseTitle } = await req.json() as {
      fileName: string;
      mimeType: string;
      fileSize: number;
      courseTitle: string;
    };

    const accessToken = await getAccessToken();

    const folderId = await findOrCreateFolder(accessToken, courseTitle || "General", ROOT_FOLDER_ID);

    // Iniciar resumable upload
    const metadata = {
      name: fileName,
      parents: [folderId],
      driveId: SHARED_DRIVE_ID,
    };

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": mimeType,
          "X-Upload-Content-Length": String(fileSize),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`Drive resumable init falló (${initRes.status}): ${errText}`);
    }

    const uploadUrl = initRes.headers.get("Location");
    console.log("[resumable-init] initRes.status:", initRes.status);
    console.log("[resumable-init] uploadUrl:", uploadUrl);
    if (!uploadUrl) throw new Error("Drive no retornó Location header");

    return NextResponse.json({ uploadUrl, folderId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[resumable-init] ERROR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
