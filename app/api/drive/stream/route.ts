import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import https from "https";

const driveServiceAccount = process.env.DRIVE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.DRIVE_SERVICE_ACCOUNT_JSON)
  : null;

function getAuthClient() {
  return new google.auth.GoogleAuth({
    credentials: driveServiceAccount,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

// Cache de URLs directas del CDN de Drive
const cdnCache = new Map<string, { url: string; expires: number }>();

// Usa https nativo para capturar el header Location sin descargar el body
function getRedirectLocation(url: string, token: string): Promise<string | null> {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: "GET",
        headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        const loc = res.headers.location ?? null;
        res.destroy();
        req.destroy();
        resolve(loc && (res.statusCode ?? 0) >= 300 ? loc : null);
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(6000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) return new NextResponse("fileId requerido", { status: 400 });

  try {
    const auth = getAuthClient();
    const token = await auth.getAccessToken();
    if (!token) throw new Error("No se pudo obtener token.");

    const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    const rangeHeader = req.headers.get("range");

    // 1. Revisar caché
    const cached = cdnCache.get(fileId);
    if (cached && cached.expires > Date.now()) {
      return new NextResponse(null, { status: 307, headers: { Location: cached.url } });
    }

    // 2. Obtener URL directa del CDN de Drive
    const cdnUrl = await getRedirectLocation(driveApiUrl, token);
    if (cdnUrl) {
      cdnCache.set(fileId, { url: cdnUrl, expires: Date.now() + 50 * 60 * 1000 });
      return new NextResponse(null, { status: 307, headers: { Location: cdnUrl } });
    }

    // 3. Fallback: proxy directo (archivos pequeños que Drive devuelve sin redirigir)
    const fetchHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

    const driveRes = await fetch(driveApiUrl, { headers: fetchHeaders });
    if (!driveRes.ok && driveRes.status !== 206) {
      return new NextResponse(`Drive error: ${driveRes.status}`, { status: driveRes.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", driveRes.headers.get("content-type") ?? "video/mp4");
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=3600");
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
