import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SHARED_DRIVE_ID = "0AOIl1AbCEbVfUk9PVA";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const driveServiceAccount = process.env.DRIVE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.DRIVE_SERVICE_ACCOUNT_JSON)
  : null;

async function getAccessToken(): Promise<string> {
  const auth = new google.auth.GoogleAuth({
    credentials: driveServiceAccount,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  if (!tokenRes.token) throw new Error("No se pudo obtener access_token de la cuenta de servicio");
  return tokenRes.token;
}

async function findOrCreateFolder(accessToken: string, name: string, parentId: string): Promise<string> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`
  );
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive&corpora=drive&driveId=${SHARED_DRIVE_ID}&includeItemsFromAllDrives=true&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json() as { files?: { id: string }[] };
  if (listData.files?.[0]?.id) return listData.files[0].id;

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

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization:             `Bearer ${accessToken}`,
          "Content-Type":            "application/json",
          "X-Upload-Content-Type":   mimeType,
          "X-Upload-Content-Length": String(fileSize),
        },
        body: JSON.stringify({ name: fileName, parents: [folderId] }),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`Drive resumable init falló (${initRes.status}): ${errText}`);
    }

    const uploadUrl = initRes.headers.get("Location");
    console.log("[resumable-init] status:", initRes.status, "| uploadUrl:", uploadUrl?.substring(0, 60));
    if (!uploadUrl) throw new Error("Drive no retornó Location header");

    return NextResponse.json({ uploadUrl, folderId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[resumable-init] ERROR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
