"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";
import {
  getCourse,
  getChaptersByCourse,
  getResourcesByChapter,
  getCourseProgressSummary,
} from "@/lib/firestore";
import type { Course, Chapter } from "@/types";
import type { ParticipantProgressSummary } from "@/lib/firestore";

// ── Colores TEXO ──────────────────────────────────────────────────────────────

const C_VERDE    = "#3A9688";
const C_AMARILLO = "#E8B84B";
const C_GRIS     = "#9CA3AF";
const C_AZUL     = "#31484E";

const TOOLTIP_STYLE = {
  contentStyle: { background: C_AZUL, color: "white", border: "none", borderRadius: "8px", fontSize: "13px" },
  labelStyle:   { color: "white" },
  itemStyle:    { color: "white" },
};

// ── Tipos internos ────────────────────────────────────────────────────────────

interface ChapterInfo {
  chapter: Chapter;
  resourceCount: number;
  cumulativeCount: number;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function CourseProgressPage() {
  const { courseId } = useParams<{ courseId: string }>();

  const [course,       setCourse]       = useState<Course | null>(null);
  const [chapterInfos, setChapterInfos] = useState<ChapterInfo[]>([]);
  const [summaries,    setSummaries]    = useState<ParticipantProgressSummary[]>([]);
  const [loading,      setLoading]      = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const courseData = await getCourse(courseId);
      if (courseData) setCourse(courseData);

      const chapters = await getChaptersByCourse(courseId);
      let cumulative = 0;
      const infos: ChapterInfo[] = [];
      for (const chapter of chapters) {
        const resources = await getResourcesByChapter(courseId, chapter.id);
        cumulative += resources.length;
        infos.push({ chapter, resourceCount: resources.length, cumulativeCount: cumulative });
      }
      setChapterInfos(infos);

      const data = await getCourseProgressSummary(courseId);
      setSummaries(data);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalResources    = chapterInfos[chapterInfos.length - 1]?.cumulativeCount ?? 0;
  const totalParticipants = summaries.length;
  const completed100 = summaries.filter(
    (s) => totalResources > 0 && s.completedResourceCount >= totalResources
  ).length;
  const inProgress = summaries.filter(
    (s) => s.completedResourceCount > 0 &&
      (totalResources === 0 || s.completedResourceCount < totalResources)
  ).length;
  const notStarted = summaries.filter((s) => s.completedResourceCount === 0).length;

  // ── Datos para gráficos ───────────────────────────────────────────────────

  const pieData = [
    { name: "Completaron 100%", value: completed100, color: C_VERDE    },
    { name: "En progreso",      value: inProgress,   color: C_AMARILLO },
    { name: "Sin iniciar",      value: notStarted,   color: C_GRIS     },
  ].filter((d) => d.value > 0);

  const chapterBarData = useMemo(() =>
    chapterInfos.map((info) => {
      const completedCount = summaries.filter(
        (s) => s.completedResourceCount >= info.cumulativeCount && info.resourceCount > 0
      ).length;
      const pct = totalParticipants > 0 ? Math.round((completedCount / totalParticipants) * 100) : 0;
      return {
        name: info.chapter.title.length > 20
          ? info.chapter.title.slice(0, 20) + "…"
          : info.chapter.title,
        pct,
      };
    }),
  [chapterInfos, summaries, totalParticipants]);

  // ── Render ────────────────────────────────────────────────────────────────

  const chartBg = "bg-gray-50 dark:bg-gray-800 rounded-2xl p-6";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link
        href={`/artesano/cursos/${courseId}`}
        className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        ← Volver al curso
      </Link>

      <div className="mt-4 mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 border-b-[3px] border-texo-amarillo inline-block">
            Progreso del propedéutico
          </h1>
          {course && <p className="text-gray-400 text-sm mt-1">{course.title}</p>}
        </div>
        <Link
          href="/artesano/alumnos"
          className="text-sm px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300 whitespace-nowrap self-start"
        >
          Ver todos los Participantes →
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-texo-verde/30 border-t-texo-verde rounded-full animate-spin" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-gray-400 text-sm">Ningún participante inscripto todavía.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* Cards de resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total inscriptos",  value: totalParticipants, color: "text-texo-azul dark:text-white" },
              { label: "Completaron 100%",  value: completed100,      color: "text-texo-verde"    },
              { label: "En progreso",       value: inProgress,        color: "text-texo-amarillo" },
              { label: "Sin iniciar",       value: notStarted,        color: "text-gray-400"      },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-400 mt-1 leading-snug">{label}</p>
              </div>
            ))}
          </div>

          {/* Gráfico de torta: distribución de progreso */}
          {pieData.length > 0 && (
            <div className={chartBg}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                Distribución de progreso
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ value, percent }) =>
                      `${value} (${Math.round((percent ?? 0) * 100)}%)`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gráfico de barras: completación por capítulo */}
          {chapterBarData.length > 0 && (
            <div className={chartBg}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                Tasa de completación por capítulo
              </h2>
              <p className="text-xs text-gray-400 mb-4">% de participantes que completaron cada capítulo</p>
              <ResponsiveContainer width="100%" height={Math.max(200, chapterBarData.length * 44)}>
                <BarChart
                  data={chapterBarData}
                  layout="vertical"
                  margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: C_GRIS }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: C_GRIS }} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Completación"]} />
                  <Bar dataKey="pct" fill={C_VERDE} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="pct" position="right" formatter={(v: any) => `${v}%`} style={{ fontSize: 11, fill: C_GRIS }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


