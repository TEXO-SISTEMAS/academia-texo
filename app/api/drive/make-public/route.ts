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

export async function POST(req: NextRequest) {
  try {
    const { fileId } = await req.json() as { fileId: string };
    if (!fileId) {
      return NextResponse.json({ error: "fileId requerido" }, { status: 400 });
    }

    console.log("[make-public] fileId:", fileId);

    const accessToken = await getAccessToken();

    const permRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      }
    );

    if (!permRes.ok) {
      const errText = await permRes.text();
      throw new Error(`Error aplicando permisos (${permRes.status}): ${errText}`);
    }

    const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;
    const directLink  = `https://drive.google.com/file/d/${fileId}/preview`;

    console.log("[make-public] OK —", directLink);

    return NextResponse.json({ fileId, webViewLink, directLink });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[make-public] ERROR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
