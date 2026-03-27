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

      // Contar inscriptos usando collectionGroup
      const progressRef = collectionGroup(db, 'courses')
      const enrolledQuery = query(progressRef, where('courseId', '==', courseId))
      const enrolledSnap = await getDocs(enrolledQuery)

      return {
        id: courseId,
        title: courseData.title as string,
        enrolledCount: enrolledSnap.size,
        completedCount: 0,
        completionRate: 0,
      }
    })
  )

  return coursesWithStats
}
