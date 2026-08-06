/**
 * Backfills /participantStats and /quizResponses from existing Firestore data.
 * Run once after deploying the pre-aggregated collections feature.
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/migrate-preaggregated.ts
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
  console.log("=== Migración: colecciones pre-agregadas ===");

  // 1. Leer todos los participantes
  const usersSnap = await db.collection("users").where("role", "==", "participante").get();
  console.log(`Participantes encontrados: ${usersSnap.size}`);

  // 2. Leer todos los cursos publicados (para títulos)
  const coursesSnap = await db.collection("courses").where("published", "==", true).get();
  const courseNameMap = new Map(coursesSnap.docs.map(d => [d.id, (d.data().title as string) ?? d.id]));

  // 3. Leer estructura de recursos por curso (para totalCount y quiz content)
  const courseResourceCount = new Map<string, number>();
  const courseResourceData = new Map<string, admin.firestore.DocumentData>(); // "cid::rid" → data
  for (const courseDoc of coursesSnap.docs) {
    const cid = courseDoc.id;
    const chaptersSnap = await db.collection(`courses/${cid}/chapters`).get();
    for (const chDoc of chaptersSnap.docs) {
      const resourcesSnap = await db.collection(`courses/${cid}/chapters/${chDoc.id}/resources`).get();
      for (const rDoc of resourcesSnap.docs) {
        if (!rDoc.data().deleted) {
          courseResourceCount.set(cid, (courseResourceCount.get(cid) ?? 0) + 1);
          courseResourceData.set(`${cid}::${rDoc.id}`, rDoc.data());
        }
      }
    }
  }
  console.log(`Cursos con recursos contados: ${courseResourceCount.size}`);

  let statsWritten = 0;
  let quizWritten = 0;

  // Usar batch para escrituras eficientes
  const BATCH_LIMIT = 499;
  let batch = db.batch();
  let batchCount = 0;

  async function flushBatch() {
    if (batchCount === 0) return;
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }

  async function batchSet(ref: admin.firestore.DocumentReference, data: Record<string, unknown>, merge = false) {
    if (batchCount >= BATCH_LIMIT) await flushBatch();
    batch.set(ref, data, merge ? { merge: true } : {});
    batchCount++;
  }

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    const rawEmail = (userData.email as string | undefined) ?? "";
    const email = rawEmail.includes("@") ? rawEmail : userId.includes("@") ? userId : rawEmail || userId;

    // Leer progreso del participante
    let coursesSnap2: admin.firestore.QuerySnapshot;
    try {
      coursesSnap2 = await db.collection(`progress/${userId}/courses`).get();
    } catch {
      console.warn(`  No se pudo leer progreso de ${userId}`);
      continue;
    }

    let creditos = 0;
    let cursosInscritos = 0;
    let ultimaActividad: admin.firestore.Timestamp | null = null;
    const coursesStats: Record<string, unknown> = {};

    for (const enrollDoc of coursesSnap2.docs) {
      const cid = enrollDoc.id;
      const enrollData = enrollDoc.data();
      cursosInscritos++;
      if (enrollData.creditEarned === true) creditos++;

      const enrolledAt = enrollData.enrolledAt as admin.firestore.Timestamp | undefined;

      // Leer recursos completados
      const resourcesSnap = await db.collection(`progress/${userId}/courses/${cid}/resources`).get();
      let completedCount = 0;

      for (const rDoc of resourcesSnap.docs) {
        const rData = rDoc.data();
        if (rData.completed === true) {
          completedCount++;
          const completedAt = rData.completedAt as admin.firestore.Timestamp | undefined;
          if (completedAt && (!ultimaActividad || completedAt.toMillis() > ultimaActividad.toMillis())) {
            ultimaActividad = completedAt;
          }

          // Escribir quizResponse si tiene answers
          if (Array.isArray(rData.answers) && rData.answers.length > 0) {
            const resourceId = rDoc.id;
            const courseResource = courseResourceData.get(`${cid}::${resourceId}`);
            const recursoTitulo = (courseResource?.title as string | undefined) ?? resourceId;
            const courseTitle = courseNameMap.get(cid) ?? cid;

            const quizRef = db.collection("quizResponses").doc();
            await batchSet(quizRef, {
              participante: email,
              userId,
              curso: courseTitle,
              cursoId: cid,
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
            quizWritten++;
          }
        }
      }

      if (enrolledAt && !ultimaActividad) ultimaActividad = enrolledAt;

      coursesStats[cid] = {
        completedCount,
        enrolledAt: enrolledAt ?? admin.firestore.FieldValue.serverTimestamp(),
        creditEarned: enrollData.creditEarned === true,
      };
    }

    // Escribir participantStats
    const statsRef = db.collection("participantStats").doc(userId);
    await batchSet(statsRef, {
      email,
      creditos,
      ultimaActividad: ultimaActividad ?? null,
      cursosInscritos,
      courses: coursesStats,
    });
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
