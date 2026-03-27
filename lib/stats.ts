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
  const coursesRef = collection(db, 'courses')
  const q = query(
    coursesRef,
    where('published', '==', true),
    orderBy('createdAt', 'desc')
  )

  const coursesSnap = await getDocs(q)

  const coursesWithStats = await Promise.all(
    coursesSnap.docs.map(async (courseDoc) => {
      const courseId = courseDoc.id
      const courseData = courseDoc.data()

      // Contar inscriptos
      const progressRef = collectionGroup(db, 'courses')
      const enrolledQuery = query(progressRef, where('courseId', '==', courseId))
      const enrolledSnap = await getDocs(enrolledQuery)

      // Obtener total de recursos del curso
      const chaptersRef = collection(db, `courses/${courseId}/chapters`)
      const chaptersSnap = await getDocs(chaptersRef)
      let totalResources = 0
      for (const chapterDoc of chaptersSnap.docs) {
        const resRef = collection(db, `courses/${courseId}/chapters/${chapterDoc.id}/resources`)
        const resSnap = await getDocs(resRef)
        totalResources += resSnap.size
      }

      // Contar completados
      let completedCount = 0
      for (const enrolledDoc of enrolledSnap.docs) {
        const userId = enrolledDoc.ref.parent.parent?.id
        if (!userId) continue

        const resourcesRef = collection(db, `progress/${userId}/courses/${courseId}/resources`)
        const resourcesSnap = await getDocs(resourcesRef)
        const completedResources = resourcesSnap.docs.filter(d => d.data().completed === true).length

        if (totalResources > 0 && completedResources === totalResources) {
          completedCount++
        }
      }

      return {
        id: courseId,
        title: courseData.title as string,
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
