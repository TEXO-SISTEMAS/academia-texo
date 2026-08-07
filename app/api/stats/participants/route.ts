import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import type { ParticipantStats } from "@/lib/stats";
import type { firestore } from "firebase-admin";

export const revalidate = 300; // cache 5 minutos

export async function GET() {
  try {
    const db = getAdminDb();

    // 3 batch reads en paralelo — Admin SDK ignora reglas de seguridad
    const [usersSnap, allCoursesSnap, allResourcesSnap] = await Promise.all([
      db.collection("users").where("role", "==", "participante").get(),
      db.collectionGroup("courses").get(),
      db.collectionGroup("resources").get(),
    ]);

    // userId → email
    const userEmailMap = new Map<string, string>();
    for (const d of usersSnap.docs) {
      const raw = (d.data().email as string | undefined) ?? "";
      const email = raw.includes("@") ? raw : d.id.includes("@") ? d.id : raw || d.id;
      userEmailMap.set(d.id, email);
    }
    const participantIds = usersSnap.docs.map(d => d.id);
    const participantIdSet = new Set(participantIds);

    // courseId → total resource count (desde estructura del curso, sin deleted)
    const courseResourceCount = new Map<string, number>();
    for (const d of allResourcesSnap.docs) {
      const path = d.ref.path;
      if (!path.startsWith("courses/") || d.data().deleted) continue;
      const cid = path.split("/")[1];
      courseResourceCount.set(cid, (courseResourceCount.get(cid) ?? 0) + 1);
    }

    // Agrupar enrollments por userId: progress/{uid}/courses/{cid}
    const enrollmentsByUser = new Map<string, Map<string, firestore.DocumentData>>();
    for (const d of allCoursesSnap.docs) {
      const parts = d.ref.path.split("/");
      if (parts.length !== 4 || parts[0] !== "progress") continue;
      const uid = parts[1];
      if (!participantIdSet.has(uid)) continue;
      if (!enrollmentsByUser.has(uid)) enrollmentsByUser.set(uid, new Map());
      enrollmentsByUser.get(uid)!.set(parts[3], d.data());
    }

    // Agrupar recursos de progreso por "uid::courseId"
    const resourcesByUserCourse = new Map<string, firestore.DocumentData[]>();
    for (const d of allResourcesSnap.docs) {
      const parts = d.ref.path.split("/");
      if (parts.length !== 6 || parts[0] !== "progress") continue;
      const uid = parts[1];
      if (!participantIdSet.has(uid)) continue;
      const key = `${uid}::${parts[3]}`;
      if (!resourcesByUserCourse.has(key)) resourcesByUserCourse.set(key, []);
      resourcesByUserCourse.get(key)!.push(d.data());
    }

    const participants: ParticipantStats[] = [];

    for (const userId of participantIds as string[]) {
      const email = userEmailMap.get(userId) ?? userId;
      const userEnrollments = enrollmentsByUser.get(userId) ?? new Map();
      let totalProgress = 0;
      let latestDate: Date | null = null;
      let creditos = 0;

      for (const [courseId, enrollData] of Array.from(userEnrollments.entries())) {
        if (enrollData.creditEarned === true) creditos++;
        const resources = resourcesByUserCourse.get(`${userId}::${courseId}`) ?? [];
        const completed = resources.filter(r => r.completed === true).length;
        const total = courseResourceCount.get(courseId) ?? resources.length;
        totalProgress += total > 0 ? Math.min((completed / total) * 100, 100) : 0;

        for (const r of resources) {
          const completedAt = r.completedAt as firestore.Timestamp | undefined;
          if (completedAt) {
            const d = completedAt.toDate();
            if (!latestDate || d > latestDate) latestDate = d;
          }
        }
        const enrolledAt = enrollData.enrolledAt as firestore.Timestamp | undefined;
        if (enrolledAt && !latestDate) latestDate = enrolledAt.toDate();
      }

      const n = userEnrollments.size;
      participants.push({
        email,
        cursosInscritos: n,
        progresoPromedio: n > 0 ? Math.round(totalProgress / n) : 0,
        ultimaActividad: latestDate,
        creditos,
      });
    }

    participants.sort((a, b) => b.progresoPromedio - a.progresoPromedio);
    return NextResponse.json(participants);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stats/participants]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
