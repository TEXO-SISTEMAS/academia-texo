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
  const coursesRef = collection(db, 'courses')
  const q = query(
    coursesRef,
    where('published', '==', true),
    orderBy('createdAt', 'desc')
  )

  const coursesSnap = await getDocs(q)

  return coursesSnap.docs.map(doc => ({
    id: doc.id,
    title: doc.data().title as string,
    enrolledCount: 0,
    completedCount: 0,
    completionRate: 0,
  }))
}
