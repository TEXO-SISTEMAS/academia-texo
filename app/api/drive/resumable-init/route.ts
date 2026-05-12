import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

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

// Busca o crea una carpeta en la "My Drive" de la cuenta de servicio (no en el Shared Drive).
// La cuenta de servicio es propietaria de estos archivos y siempre puede leerlos,
// sin importar las políticas de la organización sobre unidades compartidas.
async function findOrCreateFolder(accessToken: string, name: string): Promise<string> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and 'root' in parents and trashed=false`
  );
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json() as { files?: { id: string }[] };
  if (listData.files?.[0]?.id) return listData.files[0].id;

  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: ["root"],
      }),
    }
  );
  const createData = await createRes.json() as { id?: string };
  if (!createData.id) throw new Error("No se pudo crear la carpeta en Drive");
  return createData.id;
}

export async function POST(req: NextRequest) {
  try {
    const { fileName, mimeType, fileSize, courseTitle, courseId } = await req.json() as {
      fileName: string;
      mimeType: string;
      fileSize: number;
      courseTitle: string;
      courseId?: string;
    };

    const folderName = courseId
      ? `${courseTitle || "General"} [${courseId.slice(0, 6)}]`
      : (courseTitle || "General");

    const accessToken = await getAccessToken();

    const folderId = await findOrCreateFolder(accessToken, folderName);

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
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
