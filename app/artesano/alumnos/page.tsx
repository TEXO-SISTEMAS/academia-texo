"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getAllParticipants,
  getParticipantProgress,
  getCoursesProgressSummary,
  cleanOrphanedUsers,
} from "@/lib/firestore";
import type { User } from "@/types";
import type { ParticipantCourseStat, CourseProgressSummaryItem } from "@/lib/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

// ── Colores TEXO ──────────────────────────────────────────────────────────────

const C_VERDE    = "#3A9688";
const C_AMARILLO = "#E8B84B";
const C_ROJO     = "#C0544A";
const C_AZUL     = "#31484E";
const C_GRIS     = "#9CA3AF";

const TOOLTIP_STYLE = {
  contentStyle: { background: C_AZUL, color: "white", border: "none", borderRadius: "8px", fontSize: "13px" },
  labelStyle:   { color: "white" },
  itemStyle:    { color: "white" },
};

// ── Tipos internos ────────────────────────────────────────────────────────────

type TabId = "participantes" | "propedeúticos";

interface ParticipantRow extends User {
  stats: ParticipantCourseStat[];
  enrolledCount: number;
  completedCount: number;
}

function pctColor(pct: number): string {
  if (pct > 75) return C_VERDE;
  if (pct >= 25) return C_AMARILLO;
  return C_ROJO;
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(weekNo).padStart(2, "0")}`;
}

function toDate(ts: ParticipantCourseStat["enrolledAt"]): Date {
  if (!ts) return new Date(0);
  return (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as unknown as number);
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ParticipantesPage() {
  const { firebaseUser } = useAuth();

  const [activeTab, setActiveTab]       = useState<TabId>("participantes");
  const [loading,   setLoading]         = useState(true);

  // Tab 1 — Participantes
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [search,       setSearch]       = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Tab 2 — Propedéuticos
  const [courses, setCourses]           = useState<CourseProgressSummaryItem[]>([]);

  const loadData = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      // Limpiar registros huérfanos (usuarios sin email) antes de cargar
      await cleanOrphanedUsers();

      const [allUsers, courseSummaries] = await Promise.all([
        getAllParticipants(),
        getCoursesProgressSummary(firebaseUser.uid),
      ]);
      setCourses(courseSummaries);

      // Para cada participante, cargar su progreso
      const rows: ParticipantRow[] = await Promise.all(
        allUsers.map(async (user) => {
          const stats = await getParticipantProgress(user.id);
          const enrolledCount   = stats.length;
          const completedCount  = stats.filter(
            (s) => s.total > 0 && s.completed >= s.total
          ).length;
          return { ...user, stats, enrolledCount, completedCount };
        })
      );
      setParticipants(rows);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Datos para gráficos (Tab 1) ────────────────────────────────────────────

  const ParticipantesPorCurso = useMemo(() => {
    const map: Record<string, { courseId: string; name: string; count: number }> = {};
    for (const course of courses) {
      map[course.courseId] = {
        courseId: course.courseId,
        name: course.courseNumber !== undefined
          ? `N°${course.courseNumber} ${course.title.slice(0, 14)}…`.replace(/…$/, course.title.length <= 14 ? "" : "…")
          : course.title.slice(0, 18),
        count: course.totalEnrolled,
      };
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [courses]);

  // ── Datos para gráficos (Tab 2) ────────────────────────────────────────────

  // LineChart: inscripciones acumuladas por semana, últimos 5 cursos con enrollments
  const lineChartData = useMemo(() => {
    const top5 = [...courses]
      .sort((a, b) => {
        const latestA = a.enrollments[0]?.enrolledAt;
        const latestB = b.enrollments[0]?.enrolledAt;
        return toDate(latestB).getTime() - toDate(latestA).getTime();
      })
      .slice(0, 5)
      .filter((c) => c.enrollments.length >= 2);

    if (top5.length === 0) return [];

    // Collect all weeks
    const allWeeks = new Set<string>();
    const perCourse: Record<string, Record<string, number>> = {};
    for (const course of top5) {
      perCourse[course.courseId] = {};
      for (const enr of course.enrollments) {
        const week = isoWeek(toDate(enr.enrolledAt));
        allWeeks.add(week);
        perCourse[course.courseId][week] = (perCourse[course.courseId][week] ?? 0) + 1;
      }
    }
    const sortedWeeks = Array.from(allWeeks).sort();

    return sortedWeeks.map((week) => {
      const point: Record<string, string | number> = { week };
      for (const course of top5) {
        const weekMap = perCourse[course.courseId];
        const weekKeys = Object.keys(weekMap).sort();
        let cumulative = 0;
        for (const w of weekKeys) {
          if (w <= week) cumulative += weekMap[w];
        }
        const label = course.courseNumber !== undefined
          ? `N°${course.courseNumber}`
          : course.title.slice(0, 10);
        point[label] = cumulative;
      }
      return point;
    });
  }, [courses]);

  const lineKeys = useMemo(() =>
    courses
      .slice(0, 5)
      .map((c) => c.courseNumber !== undefined ? `N°${c.courseNumber}` : c.title.slice(0, 10)),
  [courses]);

  const LINE_COLORS = [C_AMARILLO, C_VERDE, C_ROJO, "#818CF8", "#F472B6"];

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleRow(userId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  const filteredParticipants = useMemo(() =>
    search.trim()
      ? participants.filter((p) => p.email.toLowerCase().includes(search.toLowerCase()))
      : participants,
  [participants, search]);

  const chartBg = "bg-gray-50 dark:bg-gray-800 rounded-2xl p-6";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 border-b-[3px] border-texo-amarillo inline-block">
          Visualización de Progreso
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Seguimiento global de participantes y propedéuticos
        </p>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6 w-fit">
        {([["participantes", "Participantes"], ["propedeúticos", "Propedéuticos"]] as [TabId, string][]).map(
          ([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-5 py-2 text-sm rounded-lg font-medium transition-colors ${
                activeTab === id
                  ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-texo-verde/30 border-t-texo-verde rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════════
              TAB 1 — Participantes
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "participantes" && (
            <div className="flex flex-col gap-6">

              {/* Barra de búsqueda */}
              <input
                type="text"
                placeholder="Buscar por email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-texo-amarillo focus:border-transparent"
              />

              {/* Tabla de Participantes */}
              {filteredParticipants.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <p className="text-gray-400 text-sm">
                    {search ? "Sin resultados para esa búsqueda." : "No hay participantes registrados todavía."}
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                          <th className="py-3 px-4 w-6" />
                          <th className="py-3 px-4 font-medium text-left text-gray-500 dark:text-gray-400">
                            Email
                          </th>
                          <th className="py-3 px-4 font-medium text-left text-gray-500 dark:text-gray-400">
                            Inscriptos
                          </th>
                          <th className="py-3 px-4 font-medium text-left text-gray-500 dark:text-gray-400">
                            Completados
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredParticipants.map((row) => {
                          const expanded = expandedRows.has(row.id);
                          return (
                            <Fragment key={row.id}>
                              <tr
                                onClick={() => toggleRow(row.id)}
                                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                              >
                                <td className="py-3 px-4 text-gray-400 text-xs select-none">
                                  {expanded ? "▾" : "▸"}
                                </td>
                                <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                                  {row.email || row.displayName || "—"}
                                </td>
                                <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                                  {row.enrolledCount}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`font-semibold ${
                                      row.completedCount > 0 ? "text-texo-verde" : "text-gray-400"
                                    }`}
                                  >
                                    {row.completedCount}
                                  </span>
                                </td>
                              </tr>

                              {expanded && (
                                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/30">
                                  <td colSpan={4} className="px-6 py-4">
                                    {row.stats.length === 0 ? (
                                      <p className="text-xs text-gray-400">Sin inscripciones.</p>
                                    ) : (
                                      <div className="flex flex-col gap-3">
                                        {row.stats.map((stat) => {
                                          const courseInfo = courses.find(
                                            (c) => c.courseId === stat.courseId
                                          );
                                          const pct =
                                            stat.total > 0
                                              ? Math.round((stat.completed / stat.total) * 100)
                                              : 0;
                                          const label = courseInfo
                                            ? courseInfo.courseNumber !== undefined
                                              ? `N°${courseInfo.courseNumber} ${courseInfo.title}`
                                              : courseInfo.title
                                            : stat.courseId;
                                          return (
                                            <div key={stat.courseId}>
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[260px]">
                                                  {label}
                                                </span>
                                                <span className="text-xs font-semibold text-gray-500 ml-2 shrink-0">
                                                  {pct}%
                                                </span>
                                              </div>
                                              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                  className="h-full rounded-full transition-all"
                                                  style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: pctColor(pct),
                                                  }}
                                                />
                                              </div>
                                              <p className="text-[11px] text-gray-400 mt-0.5">
                                                {stat.completed}/{stat.total} recursos
                                              </p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Gráfico: Participantes activos por propedéutico */}
              {ParticipantesPorCurso.length > 0 && (
                <div className={chartBg}>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    Participantes inscriptos por propedéutico
                  </h2>
                  <p className="text-xs text-gray-400 mb-4">Cantidad de participantes inscriptos en cada curso</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, ParticipantesPorCurso.length * 44)}>
                    <BarChart
                      data={ParticipantesPorCurso}
                      layout="vertical"
                      margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: C_GRIS }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 12, fill: C_GRIS }}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v) => [v, "Inscriptos"]}
                      />
                      <Bar dataKey="count" fill={C_AMARILLO} radius={[0, 4, 4, 0]}>
                        <LabelList
                          dataKey="count"
                          position="right"
                          style={{ fontSize: 11, fill: C_GRIS }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2 — PROPEDÉUTICOS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "propedeúticos" && (
            <div className="flex flex-col gap-6">

              {/* Lista de propedéuticos */}
              {courses.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <p className="text-gray-400 text-sm">No hay propedéuticos todavía.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {courses.map((course) => (
                    <div
                      key={course.courseId}
                      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        {course.courseNumber !== undefined && (
                          <p className="text-[13px] text-texo-amarillo font-semibold mb-0.5">
                            PROPEDÉUTICO TEXO  {/* {course.courseNumber} */}
                          </p>
                        )}
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {course.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              course.published
                                ? "bg-texo-verde/15 text-texo-verde"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {course.published ? "Publicado" : "Borrador"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {course.totalEnrolled} inscriptos
                          </span>
                          <span
                            className="text-xs font-semibold"
                            style={{ color: pctColor(course.avgProgress) }}
                          >
                            {course.avgProgress}% promedio
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/artesano/cursos/${course.courseId}/progreso`}
                        className="text-sm px-4 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap text-gray-600 dark:text-gray-300 shrink-0"
                      >
                        Ver detalle →
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Gráfico 1: Tasa de completación por propedéutico */}
              {courses.length > 0 && (
                <div className={chartBg}>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    Tasa de completación por propedéutico
                  </h2>
                  <p className="text-xs text-gray-400 mb-4">% promedio de progreso de todos los Participantes</p>
                  <ResponsiveContainer width="100%" height={Math.max(200, courses.length * 44)}>
                    <BarChart
                      data={courses.map((c) => ({
                        name: c.courseNumber !== undefined
                          ? `N°${c.courseNumber}`
                          : c.title.slice(0, 14),
                        pct: c.avgProgress,
                      }))}
                      layout="vertical"
                      margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 11, fill: C_GRIS }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={60}
                        tick={{ fontSize: 12, fill: C_GRIS }}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(v) => [`${v}%`, "Progreso promedio"]}
                      />
                      <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                        {courses.map((c) => (
                          <Cell key={c.courseId} fill={pctColor(c.avgProgress)} />
                        ))}
                        <LabelList
                          dataKey="pct"
                          position="right"
                          formatter={(v: any) => `${v}%`}
                          style={{ fontSize: 11, fill: C_GRIS }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Gráfico 2: Inscripciones acumuladas en el tiempo */}
              <div className={chartBg}>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  Inscripciones acumuladas en el tiempo
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  Inscriptos acumulados por semana (hasta 5 propedéuticos más recientes)
                </p>
                {lineChartData.length < 2 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">
                    Sin suficientes datos para este gráfico.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={lineChartData}
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: C_GRIS }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C_GRIS }} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend
                        formatter={(value) => (
                          <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>
                        )}
                      />
                      {lineKeys.map((key, i) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={LINE_COLORS[i % LINE_COLORS.length]}
                          strokeWidth={2}
                          dot={{ fill: LINE_COLORS[i % LINE_COLORS.length], r: 3 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}



