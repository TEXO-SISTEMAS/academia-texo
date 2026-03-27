/**
 * Script de migración: agrega userId y courseId a docs existentes en progress/{email}/courses/{courseId}.
 *
 * Usa listDocuments() para detectar documentos virtuales (sin campos propios).
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
  // listDocuments() incluye documentos virtuales (solo padres de subcolecciones)
  const userRefs = await db.collection('progress').listDocuments()
  console.log(`Usuarios en /progress: ${userRefs.length}`)

  let updated = 0

  for (const userRef of userRefs) {
    const userId = userRef.id // puede ser email o uid
    const coursesSnap = await db.collection(`progress/${userId}/courses`).get()
    console.log(`  ${userId}: ${coursesSnap.size} cursos`)

    for (const courseDoc of coursesSnap.docs) {
      const data = courseDoc.data()
      const updates: Record<string, string> = {}

      if (!data.userId) updates.userId = userId
      if (!data.courseId) updates.courseId = courseDoc.id

      if (Object.keys(updates).length > 0) {
        await courseDoc.ref.update(updates)
        updated++
        console.log(`    ✓ Actualizado: ${courseDoc.id} →`, updates)
      } else {
        console.log(`    - Ya tiene userId/courseId: ${courseDoc.id}`)
      }
    }
  }

  console.log(`\nMigración completada. Documentos actualizados: ${updated}`)
}

main().catch(console.error)
