import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const driveServiceAccount = process.env.DRIVE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.DRIVE_SERVICE_ACCOUNT_JSON)
  : null;

function getAuthClient() {
  return new google.auth.GoogleAuth({
    credentials: driveServiceAccount,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

// Cache de URLs directas del CDN de Drive (en memoria)
const cdnCache = new Map<string, { url: string; expires: number }>();

export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) return new NextResponse("fileId requerido", { status: 400 });

  try {
    const auth = getAuthClient();
    const token = await auth.getAccessToken();
    if (!token) throw new Error("No se pudo obtener token.");

    const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    const rangeHeader = req.headers.get("range");

    // Revisar caché de URL directa
    const cached = cdnCache.get(fileId);
    if (cached && cached.expires > Date.now()) {
      return NextResponse.redirect(cached.url, { status: 307 });
    }

    // Probe sin seguir redirecciones para obtener la URL del CDN de Google
    const probeRes = await fetch(driveApiUrl, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "manual",
    });

    if (probeRes.status >= 300 && probeRes.status < 400) {
      const location = probeRes.headers.get("location");
      if (location) {
        // Cachear por 50 minutos (las URLs del CDN de Drive son válidas ~1h)
        cdnCache.set(fileId, { url: location, expires: Date.now() + 50 * 60 * 1000 });
        return NextResponse.redirect(location, { status: 307 });
      }
    }

    // Fallback: proxy directo (para archivos pequeños que Drive devuelve sin redirigir)
    const fetchHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

    const driveRes = await fetch(driveApiUrl, { headers: fetchHeaders });

    if (!driveRes.ok && driveRes.status !== 206) {
      console.error(`[drive/stream] Drive error ${driveRes.status} para fileId=${fileId}`);
      return new NextResponse(`Error de Drive: ${driveRes.status}`, { status: driveRes.status });
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", driveRes.headers.get("content-type") ?? "video/mp4");
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=3600");
    const contentLength = driveRes.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);
    const contentRange = driveRes.headers.get("content-range");
    if (contentRange) responseHeaders.set("Content-Range", contentRange);

    return new NextResponse(driveRes.body, {
      status: driveRes.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[drive/stream] Error:", message);
    return new NextResponse(`Error: ${message}`, { status: 500 });
  }
}
