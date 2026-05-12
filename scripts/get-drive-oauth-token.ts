/**
 * Script de uso único para obtener el refresh token de Google OAuth2.
 * Ejecutar con: npx tsx scripts/get-drive-oauth-token.ts
 *
 * Variables de entorno necesarias:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 */
import { google } from "googleapis";
import http from "http";

const CLIENT_ID     = process.env.GOOGLE_OAUTH_CLIENT_ID     ?? "";
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
const REDIRECT_URI  = "http://localhost:3001";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Falta GOOGLE_OAUTH_CLIENT_ID o GOOGLE_OAUTH_CLIENT_SECRET");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/drive"],
  prompt: "consent",
});

console.log("\n=================================================");
console.log("Abrí esta URL en el navegador:");
console.log("(iniciá sesión como danilo.sosa@texo.com.py)");
console.log("=================================================\n");
console.log(authUrl);
console.log("\nEsperando en http://localhost:3001 ...\n");

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url ?? "/", "http://localhost").searchParams.get("code");
  if (!code) { res.end("Sin código"); return; }

  res.end("<html><body><h2>Listo, podés cerrar esta pestaña.</h2></body></html>");
  server.close();

  const { tokens } = await oauth2.getToken(code);

  console.log("\n✅ REFRESH TOKEN OBTENIDO:\n");
  console.log(tokens.refresh_token);
  console.log("\n=================================================");
  console.log("Agregá estas 3 variables en Render → Environment:");
  console.log("=================================================");
  console.log(`GOOGLE_OAUTH_CLIENT_ID     = ${CLIENT_ID}`);
  console.log(`GOOGLE_OAUTH_CLIENT_SECRET = ${CLIENT_SECRET}`);
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN = ${tokens.refresh_token}`);
  console.log("=================================================\n");
});

server.listen(3001);
