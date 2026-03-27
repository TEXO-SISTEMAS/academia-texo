import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { db } from './firebase'

export interface CourseStats {
  id: string
  title: string
  enrolledCount: number
  completedCount: number
  completionRate: number
}

export interface ParticipantStats {
  email: string
  cursosInscritos: number
  progresoPromedio: number
  ultimaActividad: Date | null
}

export async function getAllParticipants(): Promise<ParticipantStats[]> {
  console.log('[Stats] Buscando participantes...')
  const progressSnap = await getDocs(collection(db, 'progress'))
  console.log('[Stats] Documentos en /progress:', progressSnap.size)
  for (const userDoc of progressSnap.docs) {
    console.log('[Stats] Usuario encontrado:', userDoc.id)
  }

  const participants = await Promise.all(
    progressSnap.docs.map(async (userDoc) => {
      const userId = userDoc.id
      const coursesSnap = await getDocs(collection(db, `progress/${userId}/courses`))

      let totalProgress = 0
      let latestDate: Date | null = null

      for (const courseDoc of coursesSnap.docs) {
        const resourcesSnap = await getDocs(
          collection(db, `progress/${userId}/courses/${courseDoc.id}/resources`)
        )
        const completed = resourcesSnap.docs.filter(d => d.data().completed).length
        const total = resourcesSnap.size
        totalProgress += total > 0 ? (completed / total) * 100 : 0

        const enrolledAt = courseDoc.data().enrolledAt as Timestamp | undefined
        if (enrolledAt) {
          const d = enrolledAt.toDate()
          if (!latestDate || d > latestDate) latestDate = d
        }
      }

      const avgProgress = coursesSnap.size > 0
        ? Math.round(totalProgress / coursesSnap.size)
        : 0

      return {
        email: userId,
        cursosInscritos: coursesSnap.size,
        progresoPromedio: avgProgress,
        ultimaActividad: latestDate,
      }
    })
  )

  return participants.sort((a, b) => b.progresoPromedio - a.progresoPromedio)
}

export async function getArtesanoCourses(): Promise<CourseStats[]> {
  const q = query(
    collection(db, 'courses'),
    where('published', '==', true),
    orderBy('createdAt', 'desc')
  )
  const coursesSnap = await getDocs(q)

  return coursesSnap.docs.filter(doc => !doc.data().deleted).map(doc => {
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
