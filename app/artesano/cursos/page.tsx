"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAllCourses } from "@/lib/firestore";
import type { Course } from "@/types";
import CourseFormModal from "@/components/artesano/CourseFormModal";
import Button from "@/components/shared/Button";

export default function ArtesanoCursos() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[Cursos] Cargando...");
      const data = await getAllCourses();
      console.log("[Cursos] Cantidad:", data.length);
      console.log("[Cursos] Data:", data);
      setCourses(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 border-b-[3px] border-texo-amarillo inline-block">
            Materiales
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Materiales
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} variant="primary">
          + Nuevo propedéutico
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/LA_ACADEMIA_NEWSLETTER.png"
            alt="Academia TEXO"
            style={{ height: 120, width: "auto", opacity: 0.3, marginBottom: "1.5rem", borderRadius: 8 }}
          />
          <p className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">
            No hay propedéuticos
          </p>
          <p className="text-sm text-gray-400 mb-6 max-w-xs">
            Creá el primer propedéutico para que aparezca aquí.
          </p>
          <Button onClick={() => setShowModal(true)} variant="primary">
            + Crear primer propedéutico
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {courses.map((course) => (
            <li
              key={course.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-1 h-10 rounded-full bg-texo-amarillo shrink-0" />
                <div className="min-w-0">
                  {course.courseNumber !== undefined && (
                    <p className="text-[13px] text-texo-amarillo font-semibold mb-0.5">
                      PROPEDÉUTICO TEXO
                    </p>
                  )}
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {course.title}
                  </p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-0.5 ${
                    course.published
                      ? "bg-texo-verde/15 text-texo-verde"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  }`}>
                    {course.published ? "Publicado" : "Borrador"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/artesano/cursos/${course.id}`}
                  className="text-sm px-4 py-1.5 bg-texo-amarillo text-texo-azul font-semibold rounded-lg hover:bg-texo-amarillo/90 transition-colors whitespace-nowrap"
                >
                  Gestionar →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <CourseFormModal
          onCreated={() => { setShowModal(false); loadCourses(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
