/**
 * Script de migración: inicializa completedCount en todos los cursos.
 *
 * Ejecutar UNA SOLA VEZ con:
 *   npx tsx scripts/init-completed-count.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as serviceAccount from '../service-account-firebase.json'

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount as object) })
}

const db = getFirestore()

async function main() {
  const coursesSnap = await db.collection('courses').get()
  console.log(`Cursos encontrados: ${coursesSnap.size}`)

  // Obtener todos los usuarios de /progress (incluye documentos virtuales)
  const userRefs = await db.collection('progress').listDocuments()
  console.log(`Usuarios en /progress: ${userRefs.length}\n`)

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id
    const courseTitle = courseDoc.data().title as string

    // 1. Total de recursos del curso
    const chaptersSnap = await db.collection(`courses/${courseId}/chapters`).get()
    let totalResources = 0
    for (const chapterDoc of chaptersSnap.docs) {
      const resSnap = await db
        .collection(`courses/${courseId}/chapters/${chapterDoc.id}/resources`)
        .get()
      totalResources += resSnap.size
    }

    // 2. Contar usuarios que completaron el 100%
    let completedCount = 0
    for (const userRef of userRefs) {
      const userId = userRef.id
      const enrollDoc = await db.doc(`progress/${userId}/courses/${courseId}`).get()
      if (!enrollDoc.exists) continue

      if (totalResources > 0) {
        const resourcesSnap = await db
          .collection(`progress/${userId}/courses/${courseId}/resources`)
          .get()
        const completedResources = resourcesSnap.docs.filter(
          d => d.data().completed === true
        ).length
        if (completedResources >= totalResources) completedCount++
      }
    }

    // 3. Guardar en el curso
    await courseDoc.ref.update({ completedCount })
    console.log(`  ${courseTitle}: totalResources=${totalResources}, completedCount=${completedCount}`)
  }

  console.log('\nMigración completada.')
}

main().catch(console.error)
