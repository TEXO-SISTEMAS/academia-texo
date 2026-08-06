/**
 * Backfills /participantStats and /quizResponses from existing Firestore data.
 * Usa collectionGroup para hacer solo 4 batch reads en vez de N*M lecturas individuales.
 * Usage: npx ts-node --project scripts/tsconfig.json scripts/migrate-preaggregated.ts
 */

import * as admin from "firebase-admin";
import * as fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./service-account-firebase.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function run() {
  console.log("=== Migración: colecciones pre-agregadas (collectionGroup) ===");

  // ── 4 batch reads en paralelo ─────────────────────────────────────────────

  console.log("Leyendo datos en paralelo...");
  const [usersSnap, coursesSnap, allCoursesSnap, allResourcesSnap] = await Promise.all([
    db.collection("users").where("role", "==", "participante").get(),
    db.collection("courses").get(),
    db.collectionGroup("courses").get(),
    db.collectionGroup("resources").get(),
  ]);

  console.log(`  usuarios participantes: ${usersSnap.size}`);
  console.log(`  docs collectionGroup courses: ${allCoursesSnap.size}`);
  console.log(`  docs collectionGroup resources: ${allResourcesSnap.size}`);

  // ── Mapas auxiliares ──────────────────────────────────────────────────────

  // courseId → title
  const courseNameMap = new Map<string, string>();
  for (const d of coursesSnap.docs) {
    courseNameMap.set(d.id, (d.data().title as string) ?? d.id);
  }

  // courseId → total resource count (desde courses/ estructura, sin deleted)
  const courseResourceCount = new Map<string, number>();
  // "courseId::resourceId" → resource data (para content de quizzes)
  const courseResourceData = new Map<string, admin.firestore.DocumentData>();

  for (const d of allResourcesSnap.docs) {
    const path = d.ref.path; // courses/{cid}/chapters/{chid}/resources/{rid}
    if (!path.startsWith("courses/")) continue;
    const parts = path.split("/"); // [courses, cid, chapters, chid, resources, rid]
    if (parts.length !== 6) continue;
    const cid = parts[1];
    const rid = parts[5];
    if (!d.data().deleted) {
      courseResourceCount.set(cid, (courseResourceCount.get(cid) ?? 0) + 1);
    }
    courseResourceData.set(`${cid}::${rid}`, d.data());
  }

  // userId → email
  const userEmailMap = new Map<string, string>();
  for (const d of usersSnap.docs) {
    const raw = (d.data().email as string | undefined) ?? "";
    const email = raw.includes("@") ? raw : d.id.includes("@") ? d.id : raw || d.id;
    userEmailMap.set(d.id, email);
  }

  const participantIds = new Set(usersSnap.docs.map(d => d.id));

  // userId → Map<courseId, enrollment doc data>
  const enrollmentsByUser = new Map<string, Map<string, admin.firestore.DocumentData>>();
  for (const d of allCoursesSnap.docs) {
    const path = d.ref.path; // progress/{uid}/courses/{cid}
    if (!path.startsWith("progress/")) continue;
    const parts = path.split("/"); // [progress, uid, courses, cid]
    if (parts.length !== 4) continue;
    const uid = parts[1];
    if (!participantIds.has(uid)) continue;
    if (!enrollmentsByUser.has(uid)) enrollmentsByUser.set(uid, new Map());
    enrollmentsByUser.get(uid)!.set(parts[3], d.data());
  }

  // "userId::courseId" → array of { resourceId, data }
  type ResourceEntry = { resourceId: string; data: admin.firestore.DocumentData };
  const progressResourcesByUserCourse = new Map<string, ResourceEntry[]>();
  for (const d of allResourcesSnap.docs) {
    const path = d.ref.path; // progress/{uid}/courses/{cid}/resources/{rid}
    if (!path.startsWith("progress/")) continue;
    const parts = path.split("/"); // [progress, uid, courses, cid, resources, rid]
    if (parts.length !== 6) continue;
    const uid = parts[1];
    if (!participantIds.has(uid)) continue;
    const cid = parts[3];
    const rid = parts[5];
    const key = `${uid}::${cid}`;
    if (!progressResourcesByUserCourse.has(key)) progressResourcesByUserCourse.set(key, []);
    progressResourcesByUserCourse.get(key)!.push({ resourceId: rid, data: d.data() });
  }

  // ── Escribir en batches ───────────────────────────────────────────────────

  const BATCH_LIMIT = 499;
  let batch = db.batch();
  let batchCount = 0;
  let statsWritten = 0;
  let quizWritten = 0;

  async function flushBatch() {
    if (batchCount === 0) return;
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }

  for (const userId of participantIds) {
    const email = userEmailMap.get(userId) ?? userId;
    const userEnrollments = enrollmentsByUser.get(userId) ?? new Map();

    let creditos = 0;
    let cursosInscritos = 0;
    let ultimaActividad: admin.firestore.Timestamp | null = null;
    const coursesStats: Record<string, unknown> = {};

    for (const [courseId, enrollData] of userEnrollments) {
      cursosInscritos++;
      if (enrollData.creditEarned === true) creditos++;

      const enrolledAt = enrollData.enrolledAt as admin.firestore.Timestamp | undefined;
      const resources = progressResourcesByUserCourse.get(`${userId}::${courseId}`) ?? [];
      let completedCount = 0;

      for (const { resourceId, data: rData } of resources) {
        if (rData.completed !== true) continue;
        completedCount++;

        const completedAt = rData.completedAt as admin.firestore.Timestamp | undefined;
        if (completedAt && (!ultimaActividad || completedAt.toMillis() > ultimaActividad.toMillis())) {
          ultimaActividad = completedAt;
        }

        // Escribir quizResponse si tiene answers
        if (Array.isArray(rData.answers) && rData.answers.length > 0) {
          const courseResource = courseResourceData.get(`${courseId}::${resourceId}`);
          const recursoTitulo = (courseResource?.title as string | undefined) ?? resourceId;
          const courseTitle = courseNameMap.get(courseId) ?? courseId;

          if (batchCount >= BATCH_LIMIT) await flushBatch();
          const quizRef = db.collection("quizResponses").doc();
          batch.set(quizRef, {
            participante: email,
            userId,
            curso: courseTitle,
            cursoId: courseId,
            recursoId: resourceId,
            recursoTitulo,
            score: (rData.score as number | undefined) ?? 0,
            totalPreguntas: rData.answers.length,
            completado: true,
            fecha: rData.completedAt ?? admin.firestore.FieldValue.serverTimestamp(),
            answers: rData.answers,
            ...(typeof rData.observations === "string" && rData.observations.trim() !== ""
              ? { observaciones: rData.observations }
              : {}),
          });
          batchCount++;
          quizWritten++;
        }
      }

      if (enrolledAt && !ultimaActividad) ultimaActividad = enrolledAt;

      coursesStats[courseId] = {
        completedCount,
        enrolledAt: enrolledAt ?? admin.firestore.FieldValue.serverTimestamp(),
        creditEarned: enrollData.creditEarned === true,
      };
    }

    if (batchCount >= BATCH_LIMIT) await flushBatch();
    const statsRef = db.collection("participantStats").doc(userId);
    batch.set(statsRef, {
      email,
      creditos,
      ultimaActividad: ultimaActividad ?? null,
      cursosInscritos,
      courses: coursesStats,
    });
    batchCount++;
    statsWritten++;
    console.log(`  [${statsWritten}] ${email}: ${cursosInscritos} cursos, ${creditos} créditos`);
  }

  await flushBatch();

  console.log(`\n✅ Migración completada:`);
  console.log(`   participantStats escritos: ${statsWritten}`);
  console.log(`   quizResponses escritos:    ${quizWritten}`);
}

run().catch(err => {
  console.error("❌ Error en migración:", err);
  process.exit(1);
});
