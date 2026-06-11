import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return new NextResponse("Falta el parámetro 'code'", { status: 400 });
  }

  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  // Derivar redirect_uri del origen del request, con fallback a env var.
  // Debe coincidir con uno de los URIs autorizados en Google Cloud Console.
  const redirectUri =
    process.env.OAUTH_REDIRECT_URI ??
    `${req.nextUrl.origin}/api/auth/oauth-callback`;

  const bodyParams = new URLSearchParams({
    code,
    client_id:     clientId,
    client_secret: clientSecret,
    redirect_uri:  redirectUri,
    grant_type:    "authorization_code",
  });

  console.log("[oauth-callback] intercambio iniciado | redirect_uri:", redirectUri);

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

  // No loguear tokens. Solo errores o estado.
  if (data.error) {
    console.log("[oauth-callback] error de Google:", data.error, data.error_description);
  } else {
    console.log("[oauth-callback] tokens recibidos:", { hasAccess: !!data.access_token, hasRefresh: !!data.refresh_token });
  }

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
