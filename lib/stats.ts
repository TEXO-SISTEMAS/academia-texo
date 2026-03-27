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
  const q = query(
    collection(db, 'courses'),
    where('published', '==', true),
    orderBy('createdAt', 'desc')
  )
  const coursesSnap = await getDocs(q)

  // Lista de userIds con algún progreso (listDocuments no existe en client SDK,
  // pero podemos leer la colección progress directamente)
  const progressUsersSnap = await getDocs(collection(db, 'progress'))
  const userIds = progressUsersSnap.docs.map(d => d.id)

  const coursesWithStats = await Promise.all(
    coursesSnap.docs.map(async (courseDoc) => {
      const courseId = courseDoc.id
      const courseData = courseDoc.data()
      const courseTitle = courseData.title as string

      // enrolledCount viene del campo guardado en el doc del curso
      const enrolledCount = (courseData.enrolledCount as number) || 0
      console.log(`[Stats] ${courseTitle}: enrolledCount=${courseData.enrolledCount}`)

      // 1. Total de recursos del curso
      const chaptersSnap = await getDocs(collection(db, `courses/${courseId}/chapters`))
      let totalResources = 0
      for (const chapterDoc of chaptersSnap.docs) {
        const resSnap = await getDocs(
          collection(db, `courses/${courseId}/chapters/${chapterDoc.id}/resources`)
        )
        totalResources += resSnap.size
      }

      let completedCount = 0

      // 2. Para cada usuario, verificar progreso
      for (const userId of userIds) {
        const enrollDoc = await getDoc(doc(db, `progress/${userId}/courses/${courseId}`))
        if (!enrollDoc.exists()) continue

        // 3. Contar recursos completados
        if (totalResources > 0) {
          const resourcesSnap = await getDocs(
            collection(db, `progress/${userId}/courses/${courseId}/resources`)
          )
          const completedResources = resourcesSnap.docs.filter(
            d => d.data().completed === true
          ).length
          if (completedResources >= totalResources) completedCount++
        }
      }

      console.log(`[Stats] ${courseTitle}: ${completedCount}/${enrolledCount} completaron`)

      return {
        id: courseId,
        title: courseTitle,
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
