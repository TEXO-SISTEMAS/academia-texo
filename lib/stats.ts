import { collection, query, where, getDocs, getDoc, doc, orderBy, Timestamp } from 'firebase/firestore'
import { db } from './firebase'

export interface CourseStats {
  id: string
  title: string
  enrolledCount: number
  completedCount: number
  completionRate: number
  avgCompletionMinutes: number
}

export interface ParticipantStats {
  email: string
  cursosInscritos: number
  progresoPromedio: number
  ultimaActividad: Date | null
}

export async function getAllParticipants(): Promise<ParticipantStats[]> {
  const progressSnap = await getDocs(collection(db, 'progress'))

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

  // Usuarios con progreso (para calcular avgCompletionDays)
  let userIds: string[] = []
  try {
    const progressSnap = await getDocs(collection(db, 'progress'))
    userIds = progressSnap.docs.map(d => d.id)
  } catch {
    // Si falla, avgCompletionDays quedará en 0
  }

  return Promise.all(
    coursesSnap.docs
      .filter(courseDoc => !courseDoc.data().deleted)
      .map(async (courseDoc) => {
        const data = courseDoc.data()
        const courseId = courseDoc.id
        const enrolledCount = (data.enrolledCount as number) || 0
        const completedCount = (data.completedCount as number) || 0

        // Calcular tiempo promedio de finalización en minutos
        let avgCompletionMinutes = 0
        if (completedCount > 0 && userIds.length > 0) {
          const minutes: number[] = []
          for (const userId of userIds) {
            try {
              const enrollDoc = await getDoc(doc(db, `progress/${userId}/courses/${courseId}`))
              if (!enrollDoc.exists()) continue
              const enrolledAt = enrollDoc.data().enrolledAt as Timestamp | undefined
              if (!enrolledAt) continue

              const resourcesSnap = await getDocs(
                collection(db, `progress/${userId}/courses/${courseId}/resources`)
              )
              const completedDocs = resourcesSnap.docs.filter(d => d.data().completed === true)
              if (completedDocs.length === 0) continue

              const latestCompletedAt = completedDocs
                .map(d => (d.data().completedAt as Timestamp | undefined)?.toDate()?.getTime() ?? 0)
                .reduce((max, t) => Math.max(max, t), 0)

              if (latestCompletedAt > 0) {
                const diffMinutes = Math.round(
                  (latestCompletedAt - enrolledAt.toDate().getTime()) / (1000 * 60)
                )
                if (diffMinutes >= 0) minutes.push(diffMinutes)
              }
            } catch {
              // ignorar errores por usuario
            }
          }
          if (minutes.length > 0) {
            avgCompletionMinutes = Math.round(minutes.reduce((s, m) => s + m, 0) / minutes.length)
          }
        }

        return {
          id: courseId,
          title: data.title as string,
          enrolledCount,
          completedCount,
          completionRate: enrolledCount > 0
            ? Math.round((completedCount / enrolledCount) * 100)
            : 0,
          avgCompletionMinutes,
        }
      })
  )
}
