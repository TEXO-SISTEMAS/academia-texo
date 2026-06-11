import { NextRequest, NextResponse } from "next/server";
import { getDriveAuth } from "@/lib/drive-auth";
import { requireAuth } from "@/lib/api-auth";

const SHARED_DRIVE_ID = "0AOIl1AbCEbVfUk9PVA";

async function getAccessToken(): Promise<string> {
  const auth = getDriveAuth();
  const tokenRes = await auth.getAccessToken();
  if (!tokenRes.token) throw new Error("No se pudo obtener access_token.");
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
  const listText = await listRes.text();
  if (!listRes.ok) {
    console.warn("[resumable-init] list error:", listText);
  } else {
    const listData = JSON.parse(listText) as { files?: { id: string }[] };
    if (listData.files?.[0]?.id) return listData.files[0].id;
  }

  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    }
  );
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`No se pudo crear carpeta (${createRes.status}): ${errText}`);
  }
  const createData = await createRes.json() as { id?: string };
  if (!createData.id) throw new Error("No se pudo crear la carpeta en Drive (sin id)");
  return createData.id;
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await requireAuth(req, { role: "artesano" });
    if (!authCheck.ok) return authCheck.response;

    const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!ROOT_FOLDER_ID) {
      return NextResponse.json({ error: "GOOGLE_DRIVE_FOLDER_ID no configurado" }, { status: 500 });
    }

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
    const folderId    = await findOrCreateFolder(accessToken, folderName, ROOT_FOLDER_ID);

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
