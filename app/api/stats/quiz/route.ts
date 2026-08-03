import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import type { QuizResponse, QuizDetailedAnswer } from "@/lib/stats";
import type { QuizContent, QuizAnswer } from "@/types";
import { Timestamp } from "firebase-admin/firestore";

export async function GET() {
  try {
    const db = getAdminDb();

    const usersSnap = await db.collection("users").where("role", "==", "participante").get();
    const responses: (QuizResponse & { fecha: string })[] = [];

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const participante = (userData.email as string | undefined) ?? userId;

      let coursesSnap;
      try {
        coursesSnap = await db.collection(`progress/${userId}/courses`).get();
      } catch { continue; }

      for (const courseDoc of coursesSnap.docs) {
        const courseId = courseDoc.id;

        const courseSnap = await db.doc(`courses/${courseId}`).get();
        const courseName = (courseSnap.data()?.title as string | undefined) ?? "Sin nombre";

        const resourcesSnap = await db.collection(`progress/${userId}/courses/${courseId}/resources`).get();

        for (const resourceDoc of resourcesSnap.docs) {
          const resourceData = resourceDoc.data();
          if (!resourceData.answers || !Array.isArray(resourceData.answers)) continue;

          let recursoTitulo = resourceDoc.id;
          let originalQuestions: QuizContent["questions"] = [];

          try {
            const chaptersSnap = await db.collection(`courses/${courseId}/chapters`).get();
            for (const chapterDoc of chaptersSnap.docs) {
              const rSnap = await db.doc(`courses/${courseId}/chapters/${chapterDoc.id}/resources/${resourceDoc.id}`).get();
              if (rSnap.exists) {
                recursoTitulo = (rSnap.data()?.title as string | undefined) ?? resourceDoc.id;
                const content = rSnap.data()?.content as QuizContent | undefined;
                if (content?.questions) originalQuestions = content.questions;
                break;
              }
            }
          } catch { /* ignorar */ }

          const savedAnswers = resourceData.answers as QuizAnswer[];

          const respuestasDetalladas: QuizDetailedAnswer[] = originalQuestions.map((q, qi) => {
            const saved = savedAnswers.find((a) => a.questionIndex === qi);

            if (q.questionType === "open") {
              return {
                pregunta: q.questionText,
                opciones: [],
                opcionesSeleccionadas: [],
                opcionesCorrectas: [],
                esCorrecta: true,
                esAbierta: true,
                respuestaAbierta: saved?.textAnswer ?? "",
              };
            }

            const selected = saved?.selectedOptions ?? [];
            const correctIndexes = q.multipleChoice ? (q.correctIndexes ?? []) : [q.correctIndex ?? 0];
            const esCorrecta = q.multipleChoice
              ? selected.length === correctIndexes.length && selected.every((i) => correctIndexes.includes(i))
              : selected[0] === correctIndexes[0];
            return {
              pregunta: q.questionText,
              opciones: q.options,
              opcionesSeleccionadas: selected,
              opcionesCorrectas: correctIndexes,
              esCorrecta,
            };
          });

          const gradedQuestionCount = originalQuestions.filter((q) => q.questionType !== "open").length;
          const completedAt = resourceData.completedAt as Timestamp | undefined;

          responses.push({
            participante,
            curso: courseName,
            cursoId: courseId,
            recursoId: resourceDoc.id,
            recursoTitulo,
            respuestasDetalladas,
            score: (resourceData.score as number | undefined) ?? 0,
            totalPreguntas: gradedQuestionCount || originalQuestions.length || savedAnswers.length,
            completado: (resourceData.completed as boolean | undefined) ?? false,
            fecha: completedAt ? completedAt.toDate().toISOString() : new Date().toISOString(),
            observaciones:
              typeof resourceData.observations === "string" && resourceData.observations.trim() !== ""
                ? (resourceData.observations as string)
                : undefined,
          });
        }
      }
    }

    responses.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return NextResponse.json(responses);
  } catch (err) {
    console.error("[stats/quiz]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
