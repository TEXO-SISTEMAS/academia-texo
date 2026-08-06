import { collection, collectionGroup, query, where, getDocs, getDoc, doc, orderBy, Timestamp } from 'firebase/firestore'
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
  // 3 batch reads en paralelo en vez de N*M reads secuenciales
  const [usersSnap, enrollmentsSnap, allResourcesSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'participante'))),
    getDocs(collectionGroup(db, 'courses')),
    getDocs(collectionGroup(db, 'resources')),
  ])

  // Mapa userId → email
  const userEmailMap = new Map(usersSnap.docs.map(d => {
    const raw = (d.data().email as string | undefined) ?? ''
    const email = raw.includes('@') ? raw : d.id.includes('@') ? d.id : raw || d.id
    return [d.id, email]
  }))

  // Enrollments: path progress/{uid}/courses/{cid}
  const progressEnrollments = enrollmentsSnap.docs.filter(d => d.ref.path.startsWith('progress/'))

  // Recursos de progreso: path progress/{uid}/courses/{cid}/resources/{rid}
  const progressResources = allResourcesSnap.docs.filter(d => d.ref.path.startsWith('progress/'))

  // Contar recursos por courseId desde la estructura del curso (no por usuario)
  const courseResourceCount = new Map<string, number>()
  for (const d of allResourcesSnap.docs) {
    if (d.ref.path.startsWith('courses/') && !d.data().deleted) {
      const courseId = d.ref.path.split('/')[1]
      courseResourceCount.set(courseId, (courseResourceCount.get(courseId) ?? 0) + 1)
    }
  }

  // Agrupar enrollments por userId
  const enrollmentsByUser = new Map<string, typeof progressEnrollments>()
  for (const d of progressEnrollments) {
    const uid = d.ref.parent.parent!.id
    if (!enrollmentsByUser.has(uid)) enrollmentsByUser.set(uid, [])
    enrollmentsByUser.get(uid)!.push(d)
  }

  // Agrupar recursos de progreso por "uid::courseId"
  const resourcesByUserCourse = new Map<string, typeof progressResources>()
  for (const d of progressResources) {
    const parts = d.ref.path.split('/') // progress, uid, courses, cid, resources, rid
    const key = `${parts[1]}::${parts[3]}`
    if (!resourcesByUserCourse.has(key)) resourcesByUserCourse.set(key, [])
    resourcesByUserCourse.get(key)!.push(d)
  }

  const participants: ParticipantStats[] = usersSnap.docs.map(userDoc => {
    const userId = userDoc.id
    const email = userEmailMap.get(userId) ?? userId
    const userEnrollments = enrollmentsByUser.get(userId) ?? []

    let totalProgress = 0
    let latestDate: Date | null = null
    let creditos = 0

    for (const enrollDoc of userEnrollments) {
      const courseId = enrollDoc.id
      const resources = resourcesByUserCourse.get(`${userId}::${courseId}`) ?? []
      const completed = resources.filter(r => r.data().completed).length
      const totalResources = courseResourceCount.get(courseId) ?? resources.length
      totalProgress += totalResources > 0 ? (completed / totalResources) * 100 : 0

      for (const rDoc of resources) {
        const completedAt = rDoc.data().completedAt as Timestamp | undefined
        if (completedAt) {
          const d = completedAt.toDate()
          if (!latestDate || d > latestDate) latestDate = d
        }
      }
      const enrolledAt = enrollDoc.data().enrolledAt as Timestamp | undefined
      if (enrolledAt && !latestDate) latestDate = enrolledAt.toDate()
      if (enrollDoc.data().creditEarned === true) creditos++
    }

    return {
      email,
      cursosInscritos: userEnrollments.length,
      progresoPromedio: userEnrollments.length > 0 ? Math.round(totalProgress / userEnrollments.length) : 0,
      ultimaActividad: latestDate,
      creditos,
    }
  })

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
  const activityMap: Record<string, { moduleLabel: string; courseTitle: string; count: number }> = {}

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
  // 3 batch reads en paralelo
  const [usersSnap, allResourcesSnap, coursesSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'participante'))),
    getDocs(collectionGroup(db, 'resources')),
    getDocs(query(collection(db, 'courses'), where('published', '==', true))),
  ])

  // Mapa userId → email
  const userEmailMap = new Map(usersSnap.docs.map(d => {
    const raw = (d.data().email as string | undefined) ?? ''
    const email = raw.includes('@') ? raw : d.id.includes('@') ? d.id : raw || d.id
    return [d.id, email]
  }))

  // Mapa courseId → title
  const courseNameMap = new Map(coursesSnap.docs.map(d => [d.id, d.data().title as string]))

  // Mapa "courseId::resourceId" → data del recurso en la estructura del curso
  // path: courses/{cid}/chapters/{chid}/resources/{rid}
  const courseResourceMap = new Map<string, Record<string, unknown>>()
  for (const d of allResourcesSnap.docs) {
    if (d.ref.path.startsWith('courses/')) {
      const parts = d.ref.path.split('/') // courses, cid, chapters, chid, resources, rid
      const key = `${parts[1]}::${parts[5]}`
      courseResourceMap.set(key, d.data() as Record<string, unknown>)
    }
  }

  // Recursos de progreso con answers
  const progressResources = allResourcesSnap.docs.filter(d =>
    d.ref.path.startsWith('progress/') && Array.isArray(d.data().answers)
  )

  const responses: QuizResponse[] = []

  for (const resourceDoc of progressResources) {
    const parts = resourceDoc.ref.path.split('/') // progress, uid, courses, cid, resources, rid
    const userId = parts[1]
    const courseId = parts[3]
    const resourceId = parts[5]

    const participante = userEmailMap.get(userId) ?? userId
    const courseName = courseNameMap.get(courseId) ?? 'Sin nombre'
    const courseResource = courseResourceMap.get(`${courseId}::${resourceId}`)

    const recursoTitulo = (courseResource?.title as string | undefined) ?? resourceId
    const content = courseResource?.content as QuizContent | undefined
    const originalQuestions = content?.questions ?? []

    const resourceData = resourceDoc.data()
    const savedAnswers = resourceData.answers as QuizAnswer[]

    const respuestasDetalladas: QuizDetailedAnswer[] = originalQuestions.map((q, qi) => {
      const saved = savedAnswers.find(a => a.questionIndex === qi)
      if (q.questionType === 'open') {
        return {
          pregunta: q.questionText,
          opciones: [],
          opcionesSeleccionadas: [],
          opcionesCorrectas: [],
          esCorrecta: true,
          esAbierta: true,
          respuestaAbierta: saved?.textAnswer ?? '',
        }
      }
      const selected = saved?.selectedOptions ?? []
      const correctIndexes = q.multipleChoice ? (q.correctIndexes ?? []) : [q.correctIndex ?? 0]
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

    const gradedQuestionCount = originalQuestions.filter(q => q.questionType !== 'open').length

    responses.push({
      participante,
      curso: courseName,
      cursoId: courseId,
      recursoId: resourceId,
      recursoTitulo,
      respuestasDetalladas,
      score: (resourceData.score as number | undefined) ?? 0,
      totalPreguntas: gradedQuestionCount || originalQuestions.length || savedAnswers.length,
      completado: (resourceData.completed as boolean | undefined) ?? false,
      fecha: (resourceData.completedAt as Timestamp | undefined)?.toDate() ?? new Date(),
      observaciones: typeof resourceData.observations === 'string' && resourceData.observations.trim() !== ''
        ? resourceData.observations : undefined,
    })
  }

  return responses.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
}
