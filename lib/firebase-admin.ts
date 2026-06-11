import admin from "firebase-admin";

function getServiceAccount() {
  // Acepta cualquiera de los dos nombres en base64 (compatibilidad con env vars existentes en Render).
  const b64 =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64 ||
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    try {
      return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    } catch {
      // continuar al fallback
    }
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      // continuar al fallback
    }
  }
  if (process.env.NODE_ENV === "development") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("../service-account-firebase.json");
    } catch {
      // continuar
    }
  }
  throw new Error("No se pudo cargar el service account de Firebase.");
}

function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;
  const serviceAccount = getServiceAccount();
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export function getAdminAuth(): admin.auth.Auth {
  return getAdminApp().auth();
}

export function getAdminDb(): admin.firestore.Firestore {
  return getAdminApp().firestore();
}
