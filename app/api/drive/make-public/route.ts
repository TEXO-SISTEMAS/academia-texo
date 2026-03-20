import { NextRequest, NextResponse } from "next/server";

async function getAccessToken(): Promise<string> {
  console.log("[make-public] obteniendo access_token con refresh_token:", process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.substring(0, 20));

  const body = new URLSearchParams({
    client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN!,
    grant_type:    "refresh_token",
  });

  console.log("[make-public] token request body (sin secret):", `client_id=${process.env.GOOGLE_OAUTH_CLIENT_ID}&grant_type=refresh_token`);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  console.log("[make-public] token response status:", res.status);
  const data = await res.json() as { access_token?: string; error?: string; error_description?: string };
  console.log("[make-public] token response:", JSON.stringify(data));

  if (!data.access_token) {
    throw new Error(`Error obteniendo access_token: ${data.error} — ${data.error_description}`);
  }
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { fileId?: string };
    const fileId = body.fileId ?? "13-tz18XLC_xMegwbDE2i0MJ8Se5SwDyn"; // fallback para test

    console.log("[make-public] fileId recibido:", fileId);

    const accessToken = await getAccessToken();
    console.log("[make-public] access_token OK, primeros 20:", accessToken.substring(0, 20));

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`;
    console.log("[make-public] llamando a:", url);

    const permRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });

    console.log("[make-public] permissions response status:", permRes.status);

    if (!permRes.ok) {
      const errText = await permRes.text();
      console.error("[make-public] permissions error body:", errText);
      throw new Error(`Error aplicando permisos (${permRes.status}): ${errText}`);
    }

    const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;
    const directLink  = `https://drive.google.com/file/d/${fileId}/preview`;

    console.log("[make-public] OK —", directLink);

    return NextResponse.json({ fileId, webViewLink, directLink });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[make-public] ERROR:", msg);
    if (err instanceof Error && err.stack) console.error("[make-public] stack:", err.stack);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
