"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { confirmToast } from "@/components/shared/ConfirmToast";
import {
  getCourse,
  getChaptersByCourse,
  toggleCoursePublished,
  deleteCourse,
  createChapter,
  updateChapter,
  reorderChapters,
} from "@/lib/firestore";
import type { Course, Chapter } from "@/types";
import ChapterForm from "@/components/artesano/ChapterForm";
import Button from "@/components/shared/Button";

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [courseData, chaptersData] = await Promise.all([
        getCourse(courseId),
        getChaptersByCourse(courseId),
      ]);
      if (!courseData) {
        router.replace("/artesano/dashboard");
        return;
      }
      setCourse(courseData);
      setChapters(chaptersData);
    } finally {
      setLoading(false);
    }
  }, [courseId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleDeleteClick() {
    confirmToast(
      "⚠️ Esto eliminará el propedéutico y todo su contenido. No se puede deshacer.",
      doDelete
    );
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await deleteCourse(courseId);
      toast.success("Propedéutico eliminado");
      router.replace("/artesano/dashboard");
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.");
      setDeleting(false);
    }
  }

  function handleTogglePublished() {
    if (!course) return;
    if (course.published) {
      confirmToast(
        "⚠️ Los participantes perderán acceso al propedéutico. ¿Despublicar?",
        doTogglePublished
      );
    } else {
      doTogglePublished();
    }
  }

  async function doTogglePublished() {
    if (!course) return;
    setToggling(true);
    try {
      await toggleCoursePublished(courseId);
      const nowPublished = !course.published;
      setCourse((prev) => prev ? { ...prev, published: nowPublished } : prev);
      toast.success(
        nowPublished
          ? "Propedéutico publicado — ya visible para los participantes"
          : "Propedéutico despublicado"
      );
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.");
    } finally {
      setToggling(false);
    }
  }

  async function handleCreateChapter(title: string, description: string) {
    try {
      await createChapter(courseId, { title, description });
      toast.success("Capítulo creado");
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.");
    }
    setShowChapterForm(false);
    loadData();
  }

  async function handleEditChapter(title: string, description: string) {
    if (!editingChapter) return;
    try {
      await updateChapter(courseId, editingChapter.id, { title, description });
      toast.success("Capítulo actualizado");
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.");
    }
    setEditingChapter(null);
    loadData();
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const newChapters = [...chapters];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newChapters[index], newChapters[swapIndex]] = [newChapters[swapIndex], newChapters[index]];
    setChapters(newChapters);
    await reorderChapters(courseId, newChapters.map((c) => c.id));
    toast.success("Orden guardado");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-texo-verde/30 border-t-texo-verde rounded-full animate-spin" />
      </div>
    );
  }
  if (!course) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link
        href="/artesano/dashboard"
        className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        ← Propedéuticos
      </Link>

      {/* Course header */}
      <div className="mt-4 mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {course.courseNumber !== undefined && (
            <p className="text-sm font-semibold text-texo-amarillo mb-1">
              Propedéutico TEXO N° {course.courseNumber}
            </p>
          )}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 border-b-[3px] border-texo-amarillo inline-block">
            {course.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {course.description}
          </p>
          <span
            className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-medium ${
              course.published
                ? "bg-texo-verde/15 text-texo-verde"
                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {course.published ? "● Publicado" : "○ Borrador"}
          </span>
        </div>
        <Button
          onClick={handleTogglePublished}
          disabled={toggling}
          variant={course.published ? "secondary" : "primary"}
          size="sm"
        >
          {toggling ? "..." : course.published ? "Despublicar" : "Publicar"}
        </Button>
      </div>

      {/* Chapters */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Capítulos
        </h2>
        <Button onClick={() => setShowChapterForm(true)} variant="primary" size="sm">
          + Agregar capítulo
        </Button>
      </div>

      {chapters.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-gray-400 text-sm">
            No hay capítulos todavía. ¡Agregá el primero!
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {chapters.map((chapter, index) => (
            <li
              key={chapter.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMove(index, "up")}
                  disabled={index === 0}
                  className="text-xs px-1 disabled:opacity-30 hover:text-texo-amarillo transition-colors"
                  title="Subir"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMove(index, "down")}
                  disabled={index === chapters.length - 1}
                  className="text-xs px-1 disabled:opacity-30 hover:text-texo-amarillo transition-colors"
                  title="Bajar"
                >
                  ▼
                </button>
              </div>
              <span className="text-sm text-gray-400 w-6 shrink-0 text-center font-mono">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {chapter.title}
                </p>
                {chapter.description && (
                  <p className="text-sm text-gray-400 truncate">
                    {chapter.description}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditingChapter(chapter)}
                  className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
                >
                  Editar
                </button>
                <Link
                  href={`/artesano/cursos/${courseId}/capitulos/${chapter.id}`}
                  className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
                >
                  Recursos
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showChapterForm && (
        <ChapterForm
          title="Nuevo capítulo"
          onSubmit={handleCreateChapter}
          onCancel={() => setShowChapterForm(false)}
        />
      )}
      {editingChapter && (
        <ChapterForm
          title="Editar capítulo"
          initial={editingChapter}
          onSubmit={handleEditChapter}
          onCancel={() => setEditingChapter(null)}
        />
      )}

      {/* Zona de peligro */}
      <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-6">
        <button
          onClick={handleDeleteClick}
          disabled={deleting}
          className="text-sm px-4 py-2 border border-texo-rojo/40 text-texo-rojo rounded-lg hover:bg-texo-rojo/10 transition-colors disabled:opacity-40"
        >
          {deleting ? "Eliminando..." : "🗑️ Eliminar curso"}
        </button>
      </div>
    </div>
  );
}
