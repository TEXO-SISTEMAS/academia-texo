"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { collection, getDocs, getDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCourse, getChaptersByCourse, getResourcesByChapter } from "@/lib/firestore";
import CertificateModal from "@/components/participante/CertificateModal";

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
  const [selectedCourse, setSelectedCourse] = useState<CompletedCourse | null>(null);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);

    try {
      // Nombre del participante
      const allowedSnap = await getDoc(doc(db, "allowedUsers", firebaseUser.uid));
      const name = allowedSnap.exists() && allowedSnap.data().name
        ? allowedSnap.data().name as string
        : firebaseUser.email?.split("@")[0] ?? "Participante";

      // Cursos inscritos
      const coursesSnap = await getDocs(
        collection(db, "progress", firebaseUser.uid, "courses")
      );

      const results: CompletedCourse[] = [];

      await Promise.all(
        coursesSnap.docs.map(async (courseDoc) => {
          const courseId = courseDoc.id;

          const chapters = await getChaptersByCourse(courseId);
          const allResources = (
            await Promise.all(chapters.map((ch) => getResourcesByChapter(courseId, ch.id)))
          ).flat();

          if (allResources.length === 0) return;

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

              {/* Acción */}
              <button
                onClick={() => setSelectedCourse(course)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-texo-amarillo text-texo-azul hover:bg-texo-amarillo/90 text-xs font-semibold transition-colors shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Ver certificado
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedCourse && (
        <CertificateModal
          participantName={selectedCourse.participantName}
          courseTitle={selectedCourse.title}
          completedAt={selectedCourse.completedAt}
          onClose={() => setSelectedCourse(null)}
        />
      )}
    </div>
  );
}
