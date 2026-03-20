"use client";

import { useState, useEffect } from "react";
import { getAllPublishedCourses, getCourseProgressStats } from "@/lib/firestore";
import { useAuth } from "@/lib/auth-context";
import type { Course } from "@/types";
import CourseCard from "@/components/shared/CourseCard";

interface CourseWithStats extends Course {
  stats: { completed: number; total: number; enrolled: boolean };
}

export default function ParticipanteDashboard() {
  const { firebaseUser } = useAuth();
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 border-b-[3px] border-texo-amarillo inline-block">
          Propedéuticos disponibles
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Aprendé a tu ritmo
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-4xl mb-3">📖</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">
            No hay propedéuticos disponibles por el momento
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => {
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
