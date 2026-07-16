/**
 * reset-credits.ts
 * Elimina creditEarned de todos los usuarios (para limpiar datos de prueba).
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/reset-credits.ts
 */

import * as admin from "firebase-admin";

const serviceAccount = require("../service-account-firebase.json");
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function main() {
  const snap = await db.collectionGroup("courses").get();
  let reset = 0;

  for (const doc of snap.docs) {
    if (doc.data().creditEarned === true) {
      await doc.ref.update({
        creditEarned: admin.firestore.FieldValue.delete(),
        creditEarnedAt: admin.firestore.FieldValue.delete(),
      });
      console.log(`  ✓ Reset: ${doc.ref.path}`);
      reset++;
    }
  }

  // También resetear completedCount en los cursos
  const coursesSnap = await db.collection("courses").get();
  for (const courseDoc of coursesSnap.docs) {
    if ((courseDoc.data().completedCount ?? 0) > 0) {
      await courseDoc.ref.update({ completedCount: 0 });
      console.log(`  ✓ completedCount=0: ${courseDoc.data().title}`);
    }
  }

  console.log(`\nListo. ${reset} créditos eliminados.`);
}

main().catch(console.error);
