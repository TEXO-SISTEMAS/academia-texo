import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
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

  return coursesSnap.docs.map(doc => {
    const data = doc.data()
    const enrolledCount = (data.enrolledCount as number) || 0
    const completedCount = (data.completedCount as number) || 0
    return {
      id: doc.id,
      title: data.title as string,
      enrolledCount,
      completedCount,
      completionRate: enrolledCount > 0
        ? Math.round((completedCount / enrolledCount) * 100)
        : 0,
    }
  })
}
