import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import type { QuizDetailedAnswer, QuizResponse } from "@/lib/stats";
import type { QuizContent, QuizAnswer } from "@/types";
import type { firestore } from "firebase-admin";

export const revalidate = 300; // cache 5 minutos

export async function GET() {
  try {
    const db = getAdminDb();

    // 2 batch reads en paralelo — Admin SDK ignora reglas de seguridad
    const [coursesSnap, allResourcesSnap] = await Promise.all([
      db.collection("courses").where("published", "==", true).get(),
      db.collectionGroup("resources").get(),
    ]);

    // courseId → title
    const courseNameMap = new Map(coursesSnap.docs.map(d => [d.id, d.data().title as string]));

    // "courseId::resourceId" → resource data (desde estructura del curso)
    const courseResourceMap = new Map<string, firestore.DocumentData>();
    for (const d of allResourcesSnap.docs) {
      const parts = d.ref.path.split("/");
      if (parts.length !== 6 || parts[0] !== "courses") continue;
      courseResourceMap.set(`${parts[1]}::${parts[5]}`, d.data());
    }

    // Recursos de progreso con answers: progress/{uid}/courses/{cid}/resources/{rid}
    const responses: QuizResponse[] = [];

    for (const d of allResourcesSnap.docs) {
      const parts = d.ref.path.split("/");
      if (parts.length !== 6 || parts[0] !== "progress") continue;
      const data = d.data();
      if (!Array.isArray(data.answers) || data.answers.length === 0) continue;

      const userId = parts[1];
      const courseId = parts[3];
      const resourceId = parts[5];
      const savedAnswers = data.answers as QuizAnswer[];

      const courseName = courseNameMap.get(courseId) ?? "Sin nombre";
      const courseResource = courseResourceMap.get(`${courseId}::${resourceId}`);
      const recursoTitulo = (courseResource?.title as string | undefined) ?? resourceId;
      const content = courseResource?.content as QuizContent | undefined;
      const originalQuestions = content?.questions ?? [];

      const respuestasDetalladas: QuizDetailedAnswer[] = originalQuestions.map((q, qi) => {
        const saved = savedAnswers.find(a => a.questionIndex === qi);
        if (q.questionType === "open") {
          return { pregunta: q.questionText, opciones: [], opcionesSeleccionadas: [], opcionesCorrectas: [], esCorrecta: true, esAbierta: true, respuestaAbierta: saved?.textAnswer ?? "" };
        }
        const selected = saved?.selectedOptions ?? [];
        const correctIndexes = q.multipleChoice ? (q.correctIndexes ?? []) : [q.correctIndex ?? 0];
        const esCorrecta = q.multipleChoice
          ? selected.length === correctIndexes.length && selected.every(i => correctIndexes.includes(i))
          : selected[0] === correctIndexes[0];
        return { pregunta: q.questionText, opciones: q.options, opcionesSeleccionadas: selected, opcionesCorrectas: correctIndexes, esCorrecta };
      });

      const gradedCount = originalQuestions.filter(q => q.questionType !== "open").length;
      const completedAt = data.completedAt as firestore.Timestamp | undefined;

      responses.push({
        participante: userId,
        curso: courseName,
        cursoId: courseId,
        recursoId: resourceId,
        recursoTitulo,
        respuestasDetalladas,
        score: (data.score as number | undefined) ?? 0,
        totalPreguntas: gradedCount || originalQuestions.length || savedAnswers.length,
        completado: (data.completed as boolean | undefined) ?? false,
        fecha: completedAt ? completedAt.toDate() : new Date(),
        observaciones: typeof data.observations === "string" && data.observations.trim() !== ""
          ? data.observations : undefined,
      });
    }

    responses.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    return NextResponse.json(responses);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stats/quiz]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
