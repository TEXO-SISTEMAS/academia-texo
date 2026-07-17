import { collection, query, where, getDocs, getDoc, doc, orderBy, Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { QuizContent, QuizAnswer } from '@/types'

export interface CourseStats {
  id: string
  title: string
  enrolledCount: number
  completedCount: number
  completionRate: number
  avgCompletionMinutes: number
}

export interface QuizDetailedAnswer {
  pregunta: string
  opciones: string[]
  opcionesSeleccionadas: number[]
  opcionesCorrectas: number[]
  esCorrecta: boolean
  esAbierta?: boolean
  respuestaAbierta?: string
}

export interface QuizResponse {
  participante: string
  curso: string
  cursoId: string
  recursoId: string
  recursoTitulo: string
  respuestasDetalladas: QuizDetailedAnswer[]
  score: number
  totalPreguntas: number
  completado: boolean
  fecha: Date
  observaciones?: string
}

export interface ParticipantStats {
  email: string
  cursosInscritos: number
  progresoPromedio: number
  ultimaActividad: Date | null
  creditos: number
}

export async function getAllParticipants(): Promise<ParticipantStats[]> {
  // Leer usuarios desde /users (más confiable que leer docs padre de /progress)
  const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'participante')))

  const participants = await Promise.all(
    usersSnap.docs.map(async (userDoc) => {
      const userId = userDoc.id
      const userData = userDoc.data()
      const email = (userData.email as string | undefined) ?? userId

      let coursesSnap
      try {
        coursesSnap = await getDocs(collection(db, `progress/${userId}/courses`))
      } catch {
        return { email, cursosInscritos: 0, progresoPromedio: 0, ultimaActividad: null, creditos: 0 }
      }

      let totalProgress = 0
      let latestDate: Date | null = null
      let creditos = 0

      for (const courseDoc of coursesSnap.docs) {
        const resourcesSnap = await getDocs(
          collection(db, `progress/${userId}/courses/${courseDoc.id}/resources`)
        )
        const completed = resourcesSnap.docs.filter(d => d.data().completed).length
        const total = resourcesSnap.size
        totalProgress += total > 0 ? (completed / total) * 100 : 0

        for (const rDoc of resourcesSnap.docs) {
          const completedAt = rDoc.data().completedAt as Timestamp | undefined
          if (completedAt) {
            const d = completedAt.toDate()
            if (!latestDate || d > latestDate) latestDate = d
          }
        }

        const enrolledAt = courseDoc.data().enrolledAt as Timestamp | undefined
        if (enrolledAt && !latestDate) {
          latestDate = enrolledAt.toDate()
        }

        if (courseDoc.data().creditEarned === true) creditos++
      }

      const avgProgress = coursesSnap.size > 0
        ? Math.round(totalProgress / coursesSnap.size)
        : 0

      return {
        email,
        cursosInscritos: coursesSnap.size,
        progresoPromedio: avgProgress,
        ultimaActividad: latestDate,
        creditos,
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

export interface ModuleActivity {
  moduleLabel: string   // "Capítulo N · Recurso X"
  courseTitle: string
  count: number         // cuántos participantes están en ese recurso como último completado
}

export async function getModuleActivity(): Promise<ModuleActivity[]> {
  const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'participante')))

  // mapa: courseId+resourceId → count
  const activityMap: Record<string, { label: string; courseTitle: string; count: number }> = {}

  await Promise.all(usersSnap.docs.map(async (userDoc) => {
    const userId = userDoc.id
    let coursesSnap
    try {
      coursesSnap = await getDocs(collection(db, `progress/${userId}/courses`))
    } catch { return }

    for (const courseDoc of coursesSnap.docs) {
      const courseId = courseDoc.id
      let courseName = courseId

      try {
        const cSnap = await getDoc(doc(db, `courses/${courseId}`))
        if (cSnap.exists()) courseName = (cSnap.data().title as string) ?? courseId
      } catch { /* ignore */ }

      const resourcesSnap = await getDocs(
        collection(db, `progress/${userId}/courses/${courseId}/resources`)
      )

      // Encontrar el último recurso completado o el primero no completado
      const completedDocs = resourcesSnap.docs.filter(d => d.data().completed)
      const lastResource = completedDocs.length > 0
        ? completedDocs.reduce((a, b) => {
            const aT = (a.data().completedAt as Timestamp | undefined)?.toMillis() ?? 0
            const bT = (b.data().completedAt as Timestamp | undefined)?.toMillis() ?? 0
            return bT > aT ? b : a
          })
        : null

      if (!lastResource) return

      const key = `${courseId}::${lastResource.id}`
      if (!activityMap[key]) {
        activityMap[key] = { moduleLabel: lastResource.id, courseTitle: courseName, count: 0 }

        // Intentar obtener el título real del recurso
        try {
          const chaptersSnap = await getDocs(collection(db, `courses/${courseId}/chapters`))
          for (const chapterDoc of chaptersSnap.docs) {
            const rSnap = await getDoc(doc(db, `courses/${courseId}/chapters/${chapterDoc.id}/resources/${lastResource.id}`))
            if (rSnap.exists()) {
              activityMap[key].moduleLabel = (rSnap.data().title as string) ?? lastResource.id
              break
            }
          }
        } catch { /* ignore */ }
      }

      activityMap[key].count++
    }
  }))

  return Object.values(activityMap)
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export async function getQuizResponses(): Promise<QuizResponse[]> {
  console.log('[Quiz] Buscando respuestas...')
  const progressSnap = await getDocs(collection(db, 'progress'))
  console.log('[Quiz] Usuarios encontrados:', progressSnap.size)
  const responses: QuizResponse[] = []

  for (const userDoc of progressSnap.docs) {
    const userId = userDoc.id
    const coursesSnap = await getDocs(collection(db, `progress/${userId}/courses`))

    for (const courseDoc of coursesSnap.docs) {
      const courseId = courseDoc.id

      const courseRef = doc(db, `courses/${courseId}`)
      const courseSnap = await getDoc(courseRef)
      const courseName = (courseSnap.data()?.title as string | undefined) ?? 'Sin nombre'

      const resourcesSnap = await getDocs(
        collection(db, `progress/${userId}/courses/${courseId}/resources`)
      )

      for (const resourceDoc of resourcesSnap.docs) {
        const resourceData = resourceDoc.data()
        if (!resourceData.answers || !Array.isArray(resourceData.answers)) continue

        // Buscar el recurso en los capítulos del curso para obtener título, preguntas y respuestas correctas
        let recursoTitulo = resourceDoc.id
        let originalQuestions: QuizContent['questions'] = []

        try {
          const chaptersSnap = await getDocs(collection(db, `courses/${courseId}/chapters`))
          for (const chapterDoc of chaptersSnap.docs) {
            const rRef = doc(db, `courses/${courseId}/chapters/${chapterDoc.id}/resources/${resourceDoc.id}`)
            const rSnap = await getDoc(rRef)
            if (rSnap.exists()) {
              recursoTitulo = (rSnap.data().title as string | undefined) ?? resourceDoc.id
              const content = rSnap.data().content as QuizContent | undefined
              if (content?.questions) originalQuestions = content.questions
              break
            }
          }
        } catch {
          // ignorar — recursoTitulo quedará como ID
        }

        const savedAnswers = resourceData.answers as QuizAnswer[]

        const respuestasDetalladas: QuizDetailedAnswer[] = originalQuestions.map((q, qi) => {
          const saved = savedAnswers.find(a => a.questionIndex === qi)

          if (q.questionType === "open") {
            return {
              pregunta: q.questionText,
              opciones: [],
              opcionesSeleccionadas: [],
              opcionesCorrectas: [],
              esCorrecta: true,
              esAbierta: true,
              respuestaAbierta: saved?.textAnswer ?? "",
            }
          }

          const selected = saved?.selectedOptions ?? []
          const correctIndexes = q.multipleChoice
            ? (q.correctIndexes ?? [])
            : [q.correctIndex ?? 0]
          const esCorrecta = q.multipleChoice
            ? selected.length === correctIndexes.length && selected.every(i => correctIndexes.includes(i))
            : selected[0] === correctIndexes[0]
          return {
            pregunta: q.questionText,
            opciones: q.options,
            opcionesSeleccionadas: selected,
            opcionesCorrectas: correctIndexes,
            esCorrecta,
          }
        })

        const gradedQuestionCount = originalQuestions.filter(q => q.questionType !== "open").length

        responses.push({
          participante: userId,
          curso: courseName,
          cursoId: courseId,
          recursoId: resourceDoc.id,
          recursoTitulo,
          respuestasDetalladas,
          score: (resourceData.score as number | undefined) ?? 0,
          totalPreguntas: gradedQuestionCount || originalQuestions.length || savedAnswers.length,
          completado: (resourceData.completed as boolean | undefined) ?? false,
          fecha: (resourceData.completedAt as Timestamp | undefined)?.toDate() ?? new Date(),
          observaciones: typeof resourceData.observations === "string" && resourceData.observations.trim() !== ""
            ? (resourceData.observations as string)
            : undefined,
        })
      }
    }
  }

  console.log('[Quiz] Total respuestas:', responses.length)
  return responses.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
}
