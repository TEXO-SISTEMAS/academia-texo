/**
 * Script de migración: inicializa enrolledCount en cursos existentes.
 *
 * Ejecutar UNA SOLA VEZ con:
 *   npx ts-node --project tsconfig.json scripts/init-enrolled-count.ts
 *
 * Requiere que las variables de entorno de Firebase estén disponibles.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as serviceAccount from '../service-account-firebase.json'

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount as object),
  })
}

const db = getFirestore()

async function main() {
  const coursesSnap = await db.collection('courses').get()
  console.log(`Cursos encontrados: ${coursesSnap.size}`)

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id

    // Contar docs en progress/*/courses/{courseId} via collectionGroup
    const enrolledSnap = await db
      .collectionGroup('courses')
      .where('courseId', '==', courseId)
      .get()

    const count = enrolledSnap.size
    await courseDoc.ref.update({ enrolledCount: count })
    console.log(`  ${courseDoc.data().title}: enrolledCount = ${count}`)
  }

  console.log('Migración completada.')
}

main().catch(console.error)
