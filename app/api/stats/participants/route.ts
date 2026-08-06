import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
import { getAdminDb } from "@/lib/firebase-admin";
import type { ParticipantStats } from "@/lib/stats";
import { Timestamp } from "firebase-admin/firestore";

export async function GET() {
  try {
    const db = getAdminDb();

    const usersSnap = await db.collection("users").where("role", "==", "participante").get();

    const participants = await Promise.all(
      usersSnap.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const rawEmail = (userData.email as string | undefined) ?? "";
        const email = rawEmail.includes("@") ? rawEmail : userId.includes("@") ? userId : rawEmail || userId;

        let coursesSnap;
        try {
          coursesSnap = await db.collection(`progress/${userId}/courses`).get();
        } catch {
          return { email, cursosInscritos: 0, progresoPromedio: 0, ultimaActividad: null, creditos: 0 };
        }

        let totalProgress = 0;
        let latestDate: Date | null = null;
        let creditos = 0;

        for (const courseDoc of coursesSnap.docs) {
          const courseId = courseDoc.id;
          const resourcesSnap = await db.collection(`progress/${userId}/courses/${courseId}/resources`).get();
          const completed = resourcesSnap.docs.filter((d) => d.data().completed).length;

          let totalResources = 0;
          try {
            const chaptersSnap = await db.collection(`courses/${courseId}/chapters`).get();
            for (const ch of chaptersSnap.docs) {
              const rSnap = await db.collection(`courses/${courseId}/chapters/${ch.id}/resources`).get();
              totalResources += rSnap.docs.filter((r) => !r.data().deleted).length;
            }
          } catch { /* usar los que tiene en progreso */ }

          const total = totalResources > 0 ? totalResources : resourcesSnap.size;
          totalProgress += total > 0 ? (completed / total) * 100 : 0;

          for (const rDoc of resourcesSnap.docs) {
            const completedAt = rDoc.data().completedAt as Timestamp | undefined;
            if (completedAt) {
              const d = completedAt.toDate();
              if (!latestDate || d > latestDate) latestDate = d;
            }
          }

          const enrolledAt = courseDoc.data().enrolledAt as Timestamp | undefined;
          if (enrolledAt && !latestDate) latestDate = enrolledAt.toDate();

          if (courseDoc.data().creditEarned === true) creditos++;
        }

        const avgProgress = coursesSnap.size > 0 ? Math.round(totalProgress / coursesSnap.size) : 0;

        return {
          email,
          cursosInscritos: coursesSnap.size,
          progresoPromedio: avgProgress,
          ultimaActividad: latestDate ? latestDate.toISOString() : null,
          creditos,
        };
      })
    );

    const sorted = participants.sort((a, b) => b.progresoPromedio - a.progresoPromedio);
    return NextResponse.json(sorted);
  } catch (err) {
    console.error("[stats/participants]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
