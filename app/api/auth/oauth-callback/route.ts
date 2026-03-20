import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return new NextResponse("Falta el parámetro 'code'", { status: 400 });
  }

  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const redirectUri  = "http://localhost:3000/api/auth/oauth-callback";

  const bodyParams = new URLSearchParams({
    code,
    client_id:     clientId,
    client_secret: clientSecret,
    redirect_uri:  redirectUri,
    grant_type:    "authorization_code",
  });

  console.log("[oauth-callback] code:", code?.substring(0, 20));
  console.log("[oauth-callback] client_id:", clientId);
  console.log("[oauth-callback] client_secret (primeros 6):", clientSecret?.substring(0, 6));
  console.log("[oauth-callback] redirect_uri que se envía:", redirectUri);
  console.log("[oauth-callback] body completo:", bodyParams.toString());

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyParams,
  });

  const data = await res.json() as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  console.log("[oauth-callback] respuesta de Google:", JSON.stringify(data));

  if (data.error || !data.refresh_token) {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:2rem">
        <h2>❌ Error de Google</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
        <hr/>
        <h3>Datos enviados a Google:</h3>
        <pre>client_id: ${clientId}
redirect_uri: ${redirectUri}
grant_type: authorization_code
code: ${code?.substring(0, 20)}...</pre>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return new NextResponse(
    `<html><body style="font-family:monospace;padding:2rem">
      <h2>✅ Autorización exitosa</h2>
      <p>Copiá este valor en <code>.env.local</code> como <strong>GOOGLE_OAUTH_REFRESH_TOKEN</strong>:</p>
      <textarea rows="3" style="width:100%;font-size:14px">${data.refresh_token}</textarea>
      <p style="margin-top:1rem;color:#666">Podés cerrar esta ventana.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
