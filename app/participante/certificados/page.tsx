"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { collection, getDocs, getDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCourse, getChaptersByCourse, getResourcesByChapter } from "@/lib/firestore";
import Certificate from "@/components/participante/Certificate";
import { generateCertificatePDF } from "@/lib/certificate";

interface CompletedCourse {
  courseId: string;
  title: string;
  completedAt: Date;
  participantName: string;
}

export default function CertificadosPage() {
  const { firebaseUser } = useAuth();
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewCourse, setPreviewCourse] = useState<CompletedCourse | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("");

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);

    try {
      // Nombre del participante
      const allowedSnap = await getDoc(doc(db, "allowedUsers", firebaseUser.uid));
      const name = allowedSnap.exists() && allowedSnap.data().name
        ? allowedSnap.data().name as string
        : firebaseUser.email?.split("@")[0] ?? "Participante";
      setParticipantName(name);

      // Cursos inscritos
      const coursesSnap = await getDocs(
        collection(db, "progress", firebaseUser.uid, "courses")
      );

      const results: CompletedCourse[] = [];

      await Promise.all(
        coursesSnap.docs.map(async (courseDoc) => {
          const courseId = courseDoc.id;

          // Obtener todos los recursos del curso
          const chapters = await getChaptersByCourse(courseId);
          const allResources = (
            await Promise.all(chapters.map((ch) => getResourcesByChapter(courseId, ch.id)))
          ).flat();

          if (allResources.length === 0) return;

          // Verificar progreso
          const resourcesSnap = await getDocs(
            collection(db, "progress", firebaseUser.uid, "courses", courseId, "resources")
          );

          const progressMap: Record<string, boolean> = {};
          let latestCompletedAt: Date | null = null;

          resourcesSnap.docs.forEach((d) => {
            progressMap[d.id] = d.data().completed === true;
            const ca = d.data().completedAt as Timestamp | undefined;
            if (ca) {
              const d2 = ca.toDate();
              if (!latestCompletedAt || d2 > latestCompletedAt) latestCompletedAt = d2;
            }
          });

          const allDone = allResources.every((r) => progressMap[r.id] === true);
          if (!allDone) return;

          const courseData = await getCourse(courseId);
          if (!courseData || courseData.deleted) return;

          results.push({
            courseId,
            title: courseData.title,
            completedAt: latestCompletedAt ?? new Date(),
            participantName: name,
          });
        })
      );

      setCompletedCourses(results.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime()));
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => { load(); }, [load]);

  async function handleDownload(course: CompletedCourse) {
    setPreviewCourse(course);
    // Esperar render del certificado antes de capturar
    setTimeout(async () => {
      setDownloading(course.courseId);
      try {
        await generateCertificatePDF(course.participantName, course.title, course.completedAt);
      } finally {
        setDownloading(null);
        setPreviewCourse(null);
      }
    }, 300);
  }

  function handleLinkedIn(course: CompletedCourse) {
    const text = encodeURIComponent(
      `¡Completé exitosamente el propedéutico "${course.title}" en Academia TEXO! #Capacitación #DesarrolloProfesional #GrupoTEXO`
    );
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=https://www.linkedin.com&summary=${text}`, "_blank");
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
        {[1, 2].map(i => (
          <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse mb-4" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-texo-azul dark:text-white mb-2">Mis Certificados</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
        Propedéuticos completados al 100%
      </p>

      {completedCourses.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🎓</p>
          <p className="text-lg font-semibold text-texo-azul dark:text-white mb-2">
            Todavía no completaste ningún propedéutico
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Cuando completes uno al 100%, tu certificado aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {completedCourses.map((course) => (
            <div
              key={course.courseId}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              {/* Ícono */}
              <div className="w-12 h-12 shrink-0 rounded-full bg-texo-amarillo/20 flex items-center justify-center text-2xl">
                🎓
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-texo-azul dark:text-white text-base truncate">{course.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Completado el{" "}
                  {course.completedAt.toLocaleDateString("es-AR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleLinkedIn(course)}
                  title="Compartir en LinkedIn"
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#0077B5] text-[#0077B5] hover:bg-[#0077B5]/10 transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDownload(course)}
                  disabled={downloading === course.courseId}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-texo-amarillo text-texo-azul hover:bg-texo-amarillo/90 disabled:opacity-50 text-xs font-semibold transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  {downloading === course.courseId ? "Generando..." : "Descargar PDF"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Certificado oculto para captura */}
      {previewCourse && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, pointerEvents: "none" }}>
          <Certificate
            participantName={previewCourse.participantName}
            courseTitle={previewCourse.title}
            completedAt={previewCourse.completedAt}
          />
        </div>
      )}
    </div>
  );
}
