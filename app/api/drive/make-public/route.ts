import { NextRequest, NextResponse } from "next/server";
import { getDriveAuth } from "@/lib/drive-auth";
import { requireAuth } from "@/lib/api-auth";

async function getAccessToken(): Promise<string> {
  const auth     = getDriveAuth();
  const tokenRes = await auth.getAccessToken();
  if (!tokenRes.token) throw new Error("No se pudo obtener access_token.");
  return tokenRes.token;
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await requireAuth(req, { role: "artesano" });
    if (!authCheck.ok) return authCheck.response;

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
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      }
    );

    if (!permRes.ok) {
      const errText = await permRes.text();
      console.warn(`[make-public] Permiso público no aplicado (${permRes.status}): ${errText}`);
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
