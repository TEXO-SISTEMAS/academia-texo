import { google } from "googleapis";

/**
 * OAuth2 client autenticado como el admin del Shared Drive (danilo.sosa@texo.com.py).
 * Usa un refresh token de larga duración almacenado en GOOGLE_OAUTH_REFRESH_TOKEN.
 * El access token se renueva automáticamente cuando expira.
 */
export function getDriveAuth(): google.auth.OAuth2 {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
  oauth2.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });
  return oauth2;
}
