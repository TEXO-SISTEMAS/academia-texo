import admin from "firebase-admin";

function getServiceAccount() {
  // En Vercel: env var con el JSON en una sola línea
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      // Env var truncada (multi-línea en .env.local) — caer al archivo
    }
  }
  // En local: leer el archivo directamente
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../service-account-firebase.json");
  } catch {
    throw new Error(
      "No se pudo cargar el service account de Firebase. " +
      "Definí FIREBASE_SERVICE_ACCOUNT_JSON (una línea) o asegurate que service-account-firebase.json exista."
    );
  }
}

function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;
  const serviceAccount = getServiceAccount();
  console.log("[admin] project_id del service account:", serviceAccount.project_id);
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
