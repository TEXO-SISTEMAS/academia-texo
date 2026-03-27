/**
 * Script de migración: agrega el campo userId a docs existentes en progress/{userId}/courses/{courseId}.
 *
 * Ejecutar UNA SOLA VEZ con:
 *   npx tsx scripts/add-userId-to-progress.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as serviceAccount from '../service-account-firebase.json'

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount as object) })
}

const db = getFirestore()

async function main() {
  const progressSnap = await db.collection('progress').get()
  console.log(`Usuarios en /progress: ${progressSnap.size}`)

  let updated = 0

  for (const userDoc of progressSnap.docs) {
    const userId = userDoc.id
    const coursesSnap = await db.collection(`progress/${userId}/courses`).get()

    for (const courseDoc of coursesSnap.docs) {
      const data = courseDoc.data()
      const needsUpdate = !data.userId || !data.courseId

      if (needsUpdate) {
        await courseDoc.ref.update({
          userId: data.userId ?? userId,
          courseId: data.courseId ?? courseDoc.id,
        })
        updated++
        console.log(`  Actualizado: progress/${userId}/courses/${courseDoc.id}`)
      }
    }
  }

  console.log(`\nMigración completada. Documentos actualizados: ${updated}`)
}

main().catch(console.error)
