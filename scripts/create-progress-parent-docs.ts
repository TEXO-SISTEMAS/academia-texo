/**
 * Crea documentos padre en /progress/{userId} para que sean visibles
 * con getDocs() desde el client SDK.
 *
 * Ejecutar con: npx tsx scripts/create-progress-parent-docs.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import * as serviceAccount from '../service-account-firebase.json'

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount as object) })
}

const db = getFirestore()

async function main() {
  // Obtener todos los userId usando listDocuments (incluye virtuales)
  const userRefs = await db.collection('progress').listDocuments()
  console.log(`Usuarios con progreso encontrados: ${userRefs.length}`)

  for (const userRef of userRefs) {
    const userId = userRef.id
    const snap = await userRef.get()

    if (!snap.exists) {
      await userRef.set({ userId, createdAt: FieldValue.serverTimestamp() })
      console.log(`✓ Creado documento para: ${userId}`)
    } else {
      console.log(`- Ya existe documento para: ${userId}`)
    }
  }

  console.log('\nListo.')
}

main().catch(console.error)
