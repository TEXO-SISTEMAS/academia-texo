import admin from "firebase-admin";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const serviceAccount = require("../service-account-firebase.json");

function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

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
