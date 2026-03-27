import { collection, query, where, getDocs, collectionGroup, orderBy } from 'firebase/firestore'
import { db } from './firebase'

export interface CourseStats {
  id: string
  title: string
  enrolledCount: number
  completedCount: number
  completionRate: number
}

export async function getArtesanoCourses(): Promise<CourseStats[]> {
  const q = query(
    collection(db, 'courses'),
    where('published', '==', true),
    orderBy('createdAt', 'desc')
  )

  const coursesSnap = await getDocs(q)

  const coursesWithStats = await Promise.all(
    coursesSnap.docs.map(async (courseDoc) => {
      const courseId = courseDoc.id

      // Inscriptos: docs en /progress/*/courses donde courseId coincide
      const enrolledSnap = await getDocs(
        query(collectionGroup(db, 'courses'), where('courseId', '==', courseId))
      )

      // Total de recursos del curso
      const chaptersSnap = await getDocs(collection(db, `courses/${courseId}/chapters`))
      let totalResources = 0
      for (const chapterDoc of chaptersSnap.docs) {
        const resSnap = await getDocs(
          collection(db, `courses/${courseId}/chapters/${chapterDoc.id}/resources`)
        )
        totalResources += resSnap.size
      }

      // Completados: usuarios que tienen todos los recursos completados
      let completedCount = 0
      for (const enrolledDoc of enrolledSnap.docs) {
        const userId = enrolledDoc.ref.parent.parent?.id
        if (!userId) continue

        const resourcesSnap = await getDocs(
          collection(db, `progress/${userId}/courses/${courseId}/resources`)
        )
        const completedResources = resourcesSnap.docs.filter(d => d.data().completed === true).length

        if (totalResources > 0 && completedResources === totalResources) {
          completedCount++
        }
      }

      return {
        id: courseId,
        title: courseDoc.data().title as string,
        enrolledCount: enrolledSnap.size,
        completedCount,
        completionRate: enrolledSnap.size > 0
          ? Math.round((completedCount / enrolledSnap.size) * 100)
          : 0,
      }
    })
  )

  return coursesWithStats
}
