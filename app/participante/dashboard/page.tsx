"use client";

import { useState, useEffect } from "react";
import { getAllPublishedCourses, getCourseProgressStats } from "@/lib/firestore";
import { useAuth } from "@/lib/auth-context";
import type { Course } from "@/types";
import CourseCard from "@/components/shared/CourseCard";

interface CourseWithStats extends Course {
  stats: { completed: number; total: number; enrolled: boolean };
}

type Filter = "all" | "in-progress" | "not-started" | "completed";

export default function ParticipanteDashboard() {
  const { firebaseUser } = useAuth();
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!firebaseUser) return;

    async function load() {
      setLoading(true);
      try {
        const published = await getAllPublishedCourses();
        const withStats = await Promise.all(
          published.map(async (course) => {
            const stats = await getCourseProgressStats(
              firebaseUser!.uid,
              course.id
            );
            return { ...course, stats };
          })
        );
        setCourses(withStats);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [firebaseUser]);

  const filtered = courses.filter((course) => {
    const { completed, total, enrolled } = course.stats;
    const pct = enrolled && total > 0 ? Math.round((completed / total) * 100) : 0;

    if (search && !course.title.toLowerCase().includes(search.toLowerCase())) return false;

    if (filter === "completed") return pct === 100;
    if (filter === "in-progress") return pct > 0 && pct < 100;
    if (filter === "not-started") return pct === 0;
    return true;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 border-b-[3px] border-texo-amarillo inline-block">
          Recursos
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Aprendé a tu ritmo
        </p>
      </div>

      {/* Búsqueda y filtro */}
      {!loading && courses.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar propedéutico..."
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-texo-amarillo transition"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-texo-amarillo transition"
          >
            <option value="all">Todos</option>
            <option value="in-progress">En progreso</option>
            <option value="not-started">Sin iniciar</option>
            <option value="completed">Completados</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-4xl mb-3">📖</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {courses.length === 0
              ? "No hay propedéuticos disponibles por el momento"
              : "No hay resultados para tu búsqueda"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course) => {
            const { completed, total, enrolled } = course.stats;
            const pct =
              enrolled && total > 0
                ? Math.round((completed / total) * 100)
                : undefined;

            return (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                description={course.description}
                coverImageUrl={course.coverImageUrl}
                courseNumber={course.courseNumber}
                href={`/participante/cursos/${course.id}`}
                progressPct={pct}
                progressLabel={
                  pct !== undefined
                    ? `${completed}/${total} recursos`
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
