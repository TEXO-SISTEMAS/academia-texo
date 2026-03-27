import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase'

export interface CourseStats {
  id: string
  title: string
  enrolledCount: number
  completedCount: number
  completionRate: number
}

export async function getArtesanoCourses(): Promise<CourseStats[]> {
  console.log('[Stats] Iniciando getArtesanoCourses...')

  const q = query(
    collection(db, 'courses'),
    where('published', '==', true),
    orderBy('createdAt', 'desc')
  )
  const coursesSnap = await getDocs(q)
  console.log('[Stats] Cursos publicados encontrados:', coursesSnap.size)

  // Lista de userIds con progreso — fallback a [] si falla por permisos
  let userIds: string[] = []
  try {
    const progressUsersSnap = await getDocs(collection(db, 'progress'))
    userIds = progressUsersSnap.docs.map(d => d.id)
    console.log('[Stats] Usuarios en /progress:', userIds.length)
  } catch (err) {
    console.error('[Stats] Error leyendo /progress:', err)
  }

  const coursesWithStats = await Promise.all(
    coursesSnap.docs.map(async (courseDoc) => {
      const courseId = courseDoc.id
      const enrolledFromDoc = (courseDoc.data().enrolledCount as number) || 0

      // Si no hay userIds (error de permisos), usar enrolledCount del doc
      if (userIds.length === 0) {
        return {
          id: courseId,
          title: courseDoc.data().title as string,
          enrolledCount: enrolledFromDoc,
          completedCount: 0,
          completionRate: 0,
        }
      }

      // Total de recursos del curso
      let totalResources = 0
      try {
        const chaptersSnap = await getDocs(collection(db, `courses/${courseId}/chapters`))
        for (const chapterDoc of chaptersSnap.docs) {
          const resSnap = await getDocs(
            collection(db, `courses/${courseId}/chapters/${chapterDoc.id}/resources`)
          )
          totalResources += resSnap.size
        }
      } catch (err) {
        console.error('[Stats] Error leyendo recursos del curso', courseId, err)
      }

      let enrolledCount = 0
      let completedCount = 0

      for (const userId of userIds) {
        try {
          const enrollDoc = await getDoc(doc(db, `progress/${userId}/courses/${courseId}`))
          if (!enrollDoc.exists()) continue
          enrolledCount++

          if (totalResources > 0) {
            const resourcesSnap = await getDocs(
              collection(db, `progress/${userId}/courses/${courseId}/resources`)
            )
            const completedResources = resourcesSnap.docs.filter(
              d => d.data().completed === true
            ).length
            if (completedResources >= totalResources) completedCount++
          }
        } catch (err) {
          console.error('[Stats] Error leyendo progreso de usuario', userId, err)
        }
      }

      console.log(`[Stats] ${courseDoc.data().title}: inscriptos=${enrolledCount}, completaron=${completedCount}`)

      return {
        id: courseId,
        title: courseDoc.data().title as string,
        enrolledCount,
        completedCount,
        completionRate: enrolledCount > 0
          ? Math.round((completedCount / enrolledCount) * 100)
          : 0,
      }
    })
  )

  return coursesWithStats
}
