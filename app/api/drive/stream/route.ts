import { NextRequest, NextResponse } from "next/server";
import { getDriveAuth } from "@/lib/drive-auth";

/**
 * Proxy directo de videos desde Google Drive con OAuth token.
 * Se eliminó el CDN redirect porque las URLs del CDN de Google expiran
 * en pocos minutos, causando que el video se congele antes de terminar.
 * El OAuth token dura 1 hora — suficiente para cualquier video.
 */
export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) return new NextResponse("fileId requerido", { status: 400 });

  try {
    const auth     = getDriveAuth();
    const tokenRes = await auth.getAccessToken();
    const token    = tokenRes.token;
    if (!token) throw new Error("No se pudo obtener token.");

    const driveApiUrl   = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    const rangeHeader   = req.headers.get("range");

    const fetchHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

    const driveRes = await fetch(driveApiUrl, { headers: fetchHeaders });

    if (!driveRes.ok && driveRes.status !== 206) {
      const errBody = await driveRes.text();
      console.error(`[drive/stream] Drive error ${driveRes.status} for fileId=${fileId}:`, errBody);
      return new NextResponse(`Drive error: ${driveRes.status}`, { status: driveRes.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", driveRes.headers.get("content-type") ?? "video/mp4");
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "no-store");
    const cl = driveRes.headers.get("content-length");
    if (cl) responseHeaders.set("Content-Length", cl);
    const cr = driveRes.headers.get("content-range");
    if (cr) responseHeaders.set("Content-Range", cr);

    return new NextResponse(driveRes.body, { status: driveRes.status, headers: responseHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    console.error("[drive/stream] Error:", message);
    return new NextResponse(`Error: ${message}`, { status: 500 });
  }
}
