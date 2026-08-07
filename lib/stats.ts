import { collection, collectionGroup, query, where, getDocs, getDoc, doc, orderBy, Timestamp, documentId } from 'firebase/firestore'
import type { QuerySnapshot, DocumentData } from 'firebase/firestore'
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
  // Batch read 1: participant user IDs and emails
  const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'participante')))
  if (usersSnap.empty) return []

  const participantIds = usersSnap.docs.map(d => d.id)
  const userEmailMap = new Map(usersSnap.docs.map(d => {
    const raw = (d.data().email as string | undefined) ?? ''
    const email = raw.includes('@') ? raw : d.id.includes('@') ? d.id : raw || d.id
    return [d.id, email]
  }))

  // Batch read 2: collectionGroup para progreso y estructura de cursos
  const [allCoursesSnap, allResourcesSnap] = await Promise.all([
    getDocs(collectionGroup(db, 'courses')),
    getDocs(collectionGroup(db, 'resources')),
  ])
  const courseResourceSnap = allResourcesSnap

  const courseResourceCount = new Map<string, number>()
  for (const d of courseResourceSnap.docs) {
    if (d.ref.path.startsWith('courses/') && !d.data().deleted) {
      const courseId = d.ref.path.split('/')[1]
      courseResourceCount.set(courseId, (courseResourceCount.get(courseId) ?? 0) + 1)
    }
  }

  // Batch read 3: intentar participantStats (pre-aggregated)
  const statsMap = new Map<string, Record<string, unknown>>()
  const chunks: string[][] = []
  for (let i = 0; i < participantIds.length; i += 30) chunks.push(participantIds.slice(i, i + 30))
  await Promise.all(chunks.map(async chunk => {
    const snap = await getDocs(query(collection(db, 'participantStats'), where(documentId(), 'in', chunk)))
    for (const d of snap.docs) statsMap.set(d.id, d.data() as Record<string, unknown>)
  }))

  // Si hay datos pre-aggregados, usarlos (camino rápido)
  if (statsMap.size > 0) {
    return participantIds.map(userId => {
      const email = userEmailMap.get(userId) ?? userId
      const stats = statsMap.get(userId)
      if (!stats) return { email, cursosInscritos: 0, progresoPromedio: 0, ultimaActividad: null, creditos: 0 }

      const creditos = (stats.creditos as number) ?? 0
      const ultimaActividad = (stats.ultimaActividad as Timestamp | null)?.toDate() ?? null
      const cursosInscritos = (stats.cursosInscritos as number) ?? 0
      const courses = (stats.courses as Record<string, { completedCount?: number }> | undefined) ?? {}
      const courseIds = Object.keys(courses)

      let totalProgress = 0
      for (const cid of courseIds) {
        const completed = courses[cid].completedCount ?? 0
        const total = courseResourceCount.get(cid) ?? 1
        totalProgress += Math.min((completed / total) * 100, 100)
      }
      const progresoPromedio = courseIds.length > 0 ? Math.round(totalProgress / courseIds.length) : 0

      return { email, cursosInscritos, progresoPromedio, ultimaActividad, creditos }
    }).sort((a, b) => b.progresoPromedio - a.progresoPromedio)
  }

  // Fallback: calcular desde collectionGroup (cuando migración no corrió aún)
  const progressEnrollments = allCoursesSnap.docs.filter(d => d.ref.path.startsWith('progress/'))
  const progressResources = allResourcesSnap.docs.filter(d => d.ref.path.startsWith('progress/'))

  const enrollmentsByUser = new Map<string, typeof progressEnrollments>()
  for (const d of progressEnrollments) {
    const uid = d.ref.parent.parent!.id
    if (!enrollmentsByUser.has(uid)) enrollmentsByUser.set(uid, [])
    enrollmentsByUser.get(uid)!.push(d)
  }

  const resourcesByUserCourse = new Map<string, typeof progressResources>()
  for (const d of progressResources) {
    const parts = d.ref.path.split('/')
    const key = `${parts[1]}::${parts[3]}`
    if (!resourcesByUserCourse.has(key)) resourcesByUserCourse.set(key, [])
    resourcesByUserCourse.get(key)!.push(d)
  }

  return participantIds.map(userId => {
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
        if (completedAt) { const d = completedAt.toDate(); if (!latestDate || d > latestDate) latestDate = d }
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
  }).sort((a, b) => b.progresoPromedio - a.progresoPromedio)
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
  // Siempre necesitamos: courses (títulos) + resources (contenido quiz + progreso)
  const [coursesSnap, courseResourceSnap] = await Promise.all([
    getDocs(query(collection(db, 'courses'), where('published', '==', true))),
    getDocs(collectionGroup(db, 'resources')),
  ])

  // Intentar pre-aggregated primero
  const quizSnap = await getDocs(collection(db, 'quizResponses'))
  if (quizSnap.empty) {
    // Fallback: calcular desde progreso directo
    return _getQuizResponsesFromProgress(coursesSnap, courseResourceSnap)
  }

  const courseNameMap = new Map(coursesSnap.docs.map(d => [d.id, d.data().title as string]))

  // Mapa "courseId::resourceId" → resource data from course structure
  const courseResourceMap = new Map<string, Record<string, unknown>>()
  for (const d of courseResourceSnap.docs) {
    if (d.ref.path.startsWith('courses/')) {
      const parts = d.ref.path.split('/') // courses, cid, chapters, chid, resources, rid
      const key = `${parts[1]}::${parts[5]}`
      courseResourceMap.set(key, d.data() as Record<string, unknown>)
    }
  }

  const responses: QuizResponse[] = []

  for (const quizDoc of quizSnap.docs) {
    const data = quizDoc.data()
    const cursoId = data.cursoId as string
    const recursoId = data.recursoId as string
    const savedAnswers = (data.answers as QuizAnswer[]) ?? []

    const courseName = courseNameMap.get(cursoId) ?? (data.curso as string | undefined) ?? 'Sin nombre'
    const courseResource = courseResourceMap.get(`${cursoId}::${recursoId}`)
    const content = courseResource?.content as QuizContent | undefined
    const originalQuestions = content?.questions ?? []

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
    const fecha = (data.fecha as Timestamp | undefined)?.toDate() ?? new Date()

    responses.push({
      participante: data.participante as string,
      curso: courseName,
      cursoId,
      recursoId,
      recursoTitulo: (data.recursoTitulo as string) ?? recursoId,
      respuestasDetalladas,
      score: (data.score as number) ?? 0,
      totalPreguntas: gradedQuestionCount || originalQuestions.length || savedAnswers.length,
      completado: (data.completado as boolean) ?? false,
      fecha,
      observaciones: typeof data.observaciones === 'string' && data.observaciones.trim() !== ''
        ? data.observaciones : undefined,
    })
  }

  return responses.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
}

function _getQuizResponsesFromProgress(
  coursesSnap: QuerySnapshot<DocumentData>,
  allResourcesSnap: QuerySnapshot<DocumentData>
): QuizResponse[] {
  const courseNameMap = new Map(coursesSnap.docs.map(d => [d.id, d.data().title as string]))

  const courseResourceMap = new Map<string, Record<string, unknown>>()
  for (const d of allResourcesSnap.docs) {
    if (d.ref.path.startsWith('courses/')) {
      const parts = d.ref.path.split('/')
      const key = `${parts[1]}::${parts[5]}`
      courseResourceMap.set(key, d.data() as Record<string, unknown>)
    }
  }

  const progressResources = allResourcesSnap.docs.filter(d =>
    d.ref.path.startsWith('progress/') && Array.isArray(d.data().answers)
  )

  const responses: QuizResponse[] = []

  for (const resourceDoc of progressResources) {
    const parts = resourceDoc.ref.path.split('/')
    const userId = parts[1]
    const courseId = parts[3]
    const resourceId = parts[5]
    const resourceData = resourceDoc.data()
    const savedAnswers = resourceData.answers as QuizAnswer[]
    const courseName = courseNameMap.get(courseId) ?? 'Sin nombre'
    const courseResource = courseResourceMap.get(`${courseId}::${resourceId}`)
    const recursoTitulo = (courseResource?.title as string | undefined) ?? resourceId
    const content = courseResource?.content as QuizContent | undefined
    const originalQuestions = content?.questions ?? []

    const respuestasDetalladas: QuizDetailedAnswer[] = originalQuestions.map((q, qi) => {
      const saved = savedAnswers.find(a => a.questionIndex === qi)
      if (q.questionType === 'open') {
        return { pregunta: q.questionText, opciones: [], opcionesSeleccionadas: [], opcionesCorrectas: [], esCorrecta: true, esAbierta: true, respuestaAbierta: saved?.textAnswer ?? '' }
      }
      const selected = saved?.selectedOptions ?? []
      const correctIndexes = q.multipleChoice ? (q.correctIndexes ?? []) : [q.correctIndex ?? 0]
      const esCorrecta = q.multipleChoice
        ? selected.length === correctIndexes.length && selected.every(i => correctIndexes.includes(i))
        : selected[0] === correctIndexes[0]
      return { pregunta: q.questionText, opciones: q.options, opcionesSeleccionadas: selected, opcionesCorrectas: correctIndexes, esCorrecta }
    })

    const gradedQuestionCount = originalQuestions.filter(q => q.questionType !== 'open').length
    responses.push({
      participante: userId,
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
