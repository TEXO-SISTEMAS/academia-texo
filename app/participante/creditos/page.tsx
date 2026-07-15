"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getUserCredits, getCourse, type CreditInfo } from "@/lib/firestore";
import type { Course } from "@/types";

interface CreditWithCourse extends CreditInfo {
  course: Course | null;
}

export default function CreditosPage() {
  const { firebaseUser } = useAuth();
  const [credits, setCredits] = useState<CreditWithCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    async function load() {
      const raw = await getUserCredits(firebaseUser!.uid);
      const withCourses = await Promise.all(
        raw.map(async (c) => ({
          ...c,
          course: await getCourse(c.courseId).catch(() => null),
        }))
      );
      // Ordenar por más reciente
      withCourses.sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime());
      setCredits(withCourses);
      setLoading(false);
    }
    load();
  }, [firebaseUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-texo-verde/30 border-t-texo-verde rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mis Créditos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Propedéuticos TEXO completados
        </p>
      </div>

      {credits.length === 0 ? (
        <div className="text-center py-20 flex flex-col items-center gap-4">
          <div className="text-6xl">🎟️</div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Todavía no tenés créditos. Completá un propedéutico para obtener el primero.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Contador */}
          <div className="bg-gradient-to-br from-texo-azul to-texo-verde rounded-2xl px-6 py-5 text-white flex items-center gap-4">
            <div className="text-4xl">🎟️</div>
            <div>
              <p className="text-3xl font-bold">{credits.length}</p>
              <p className="text-white/70 text-sm">
                {credits.length === 1 ? "crédito obtenido" : "créditos obtenidos"}
              </p>
            </div>
          </div>

          {/* Lista */}
          {credits.map((c, i) => (
            <div
              key={c.courseId}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-texo-amarillo/20 flex items-center justify-center shrink-0">
                <span className="text-texo-amarillo font-bold text-sm">#{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {c.course?.title ?? c.courseId}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Completado el{" "}
                  {c.earnedAt.toLocaleDateString("es-PY", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-1.5 bg-texo-verde/10 text-texo-verde text-xs font-semibold px-3 py-1 rounded-full">
                  ✓ Crédito
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
