"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { getCoursesByArtesano, deleteCourse } from "@/lib/firestore";
import { useAuth } from "@/lib/auth-context";
import type { Course } from "@/types";
import CourseFormModal from "@/components/artesano/CourseFormModal";
import Button from "@/components/shared/Button";
import { confirmToast } from "@/components/shared/ConfirmToast";

export default function ArtesanoDashboard() {
  const { firebaseUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const data = await getCoursesByArtesano(firebaseUser.uid);
      setCourses(data);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  function handleDeleteClick(course: Course) {
    confirmToast(
      "⚠️ Esto eliminará el propedéutico y todo su contenido. No se puede deshacer.",
      () => doDelete(course.id)
    );
  }

  async function doDelete(courseId: string) {
    setDeletingId(courseId);
    try {
      await deleteCourse(courseId);
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
      toast.success("Propedéutico eliminado");
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 border-b-[3px] border-texo-amarillo inline-block">
            Mis propedéuticos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Gestioná y publicá tus propedéuticos
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} variant="primary">
          + Nuevo propedéutico
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
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
            Todavía no tenés propedéuticos
          </p>
          <p className="text-sm text-gray-400 mb-6 max-w-xs">
            Creá tu primer propedéutico y comenzá a formar a tu equipo.
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
                      Propedéutico TEXO N° {course.courseNumber}
                    </p>
                  )}
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {course.title}
                  </p>
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full mt-0.5 ${
                      course.published
                        ? "bg-texo-verde/15 text-texo-verde"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {course.published ? "Publicado" : "Borrador"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDeleteClick(course)}
                  disabled={deletingId === course.id}
                  title="Archivar propedéutico"
                  className="flex items-center justify-center border border-texo-rojo/30 text-texo-rojo rounded-lg hover:bg-texo-rojo/10 transition-colors disabled:opacity-40"
                  style={{ width: 36, height: 36 }}
                >
                  {deletingId === course.id ? (
                    <span className="text-xs">...</span>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  )}
                </button>
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
          onCreated={() => {
            setShowModal(false);
            loadCourses();
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
