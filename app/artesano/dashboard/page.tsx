'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import { getArtesanoCourses, getAllParticipants, getQuizResponses, getModuleActivity, type CourseStats, type ParticipantStats, type QuizResponse, type QuizDetailedAnswer, type ModuleActivity } from '@/lib/stats'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1a2a2e', border: '1px solid #31484E', borderRadius: 8, color: '#f9fafb' },
  labelStyle: { color: '#E8B84B', fontWeight: 600 },
  itemStyle: { color: '#d1d5db' },
}

export default function ArtesanoDashboard() {
  const [activeTab, setActiveTab] = useState<'propedeuticos' | 'participantes' | 'cuestionarios'>('propedeuticos')
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-texo-dark p-8">
      <h1 className="text-3xl font-bold text-texo-azul dark:text-white mb-6">
        Estadísticas de progreso
      </h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-300 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('propedeuticos')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'propedeuticos'
              ? 'border-b-4 border-texo-amarillo text-texo-amarillo'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Por Propedéutico
        </button>
        <button
          onClick={() => setActiveTab('participantes')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'participantes'
              ? 'border-b-4 border-texo-amarillo text-texo-amarillo'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Por Participante
        </button>
        <button
          onClick={() => setActiveTab('cuestionarios')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'cuestionarios'
              ? 'border-b-4 border-texo-amarillo text-texo-amarillo'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Por Cuestionarios
        </button>
      </div>

      {/* Buscador */}
      {activeTab !== 'cuestionarios' && <div className="mb-6">
        <input
          type="text"
          placeholder={
            activeTab === 'propedeuticos'
              ? 'Buscar propedéutico...'
              : 'Buscar participante por nombre o email...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-texo-verde"
        />
      </div>}

      {activeTab === 'propedeuticos' && <PropedeuticosView searchQuery={searchQuery} />}
      {activeTab === 'participantes' && <ParticipantesView searchQuery={searchQuery} />}
      {activeTab === 'cuestionarios' && <CuestionariosView />}
    </div>
  )
}

function PropedeuticosView({ searchQuery }: { searchQuery: string }) {
  const [courses, setCourses] = useState<CourseStats[]>([])
  const [moduleActivity, setModuleActivity] = useState<ModuleActivity[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, activity] = await Promise.all([
        getArtesanoCourses().catch(() => [] as CourseStats[]),
        getModuleActivity().catch(() => [] as ModuleActivity[]),
      ])
      setCourses(data)
      setModuleActivity(activity)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [])

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalEnrolled = filtered.reduce((s, c) => s + c.enrolledCount, 0)
  const totalCompleted = filtered.reduce((s, c) => s + c.completedCount, 0)
  const avgRate = filtered.length > 0
    ? Math.round(filtered.reduce((s, c) => s + c.completionRate, 0) / filtered.length)
    : 0

  const chartData = filtered.map(c => ({
    name: c.title.length > 20 ? c.title.slice(0, 20) + '…' : c.title,
    Inscriptos: c.enrolledCount,
    Completaron: c.completedCount,
    'En progreso': Math.max(0, c.enrolledCount - c.completedCount),
  }))

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Cards de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total inscriptos" value={totalEnrolled} color="texo-azul" />
        <SummaryCard label="Total completaron" value={totalCompleted} color="texo-verde" />
        <SummaryCard label="Tasa promedio" value={`${avgRate}%`} color="texo-amarillo" />
      </div>

      {/* Gráfico — dónde están los participantes */}
      {moduleActivity.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
            ¿En qué módulo están los participantes?
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Último recurso completado por cada participante
          </p>
          <ResponsiveContainer width="100%" height={Math.max(160, moduleActivity.length * 44)}>
            <BarChart
              layout="vertical"
              data={moduleActivity.map(m => ({
                name: m.moduleLabel.length > 28 ? m.moduleLabel.slice(0, 28) + '…' : m.moduleLabel,
                curso: m.courseTitle,
                Participantes: m.count,
              }))}
              margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={170} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v: number) => [v, 'Participantes']}
                labelFormatter={(label: string, payload) => {
                  const curso = payload?.[0]?.payload?.curso
                  return curso ? `${label} — ${curso}` : label
                }}
              />
              <Bar dataKey="Participantes" fill="#3A9688" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfico de barras */}
      {filtered.length > 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
            Inscriptos · En progreso · Completaron
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Bar dataKey="Inscriptos" fill="#31484E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="En progreso" fill="#E8B84B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Completaron" fill="#3A9688" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-center py-10">
          No hay propedéuticos publicados todavía.
        </p>
      )}

      {/* Gráfico horizontal — tiempo promedio de finalización */}
      {filtered.some(c => c.avgCompletionMinutes > 0) && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            Tiempo promedio de finalización
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Tiempo que tarda un participante en completar cada curso
          </p>
          <ResponsiveContainer width="100%" height={Math.max(120, filtered.filter(c => c.avgCompletionMinutes > 0).length * 52)}>
            <BarChart
              layout="vertical"
              data={filtered.filter(c => c.avgCompletionMinutes > 0).map(c => ({
                name: c.title.length > 24 ? c.title.slice(0, 24) + '…' : c.title,
                minutos: c.avgCompletionMinutes,
                _orig: c,
              }))}
              margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} unit=" min" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v: number) => {
                  if (v < 60) return [`${v} min`, 'Promedio']
                  return [`${Math.floor(v / 60)}h ${v % 60}min`, 'Promedio']
                }}
              />
              <Bar dataKey="minutos" radius={[0, 4, 4, 0]}>
                {filtered.filter(c => c.avgCompletionMinutes > 0).map((c, i) => (
                  <Cell
                    key={i}
                    fill={c.avgCompletionMinutes < 60 ? '#3A9688' : c.avgCompletionMinutes <= 240 ? '#E8B84B' : '#C0544A'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla */}
      {filtered.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Propedéutico</th>
                <th className="px-4 py-3 text-center">Inscriptos</th>
                <th className="px-4 py-3 text-center">Completaron</th>
                <th className="px-4 py-3 text-center">Tasa %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.title}</td>
                  <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{c.enrolledCount}</td>
                  <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{c.completedCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${
                      c.completionRate >= 70 ? 'text-texo-verde'
                      : c.completionRate >= 40 ? 'text-texo-amarillo'
                      : 'text-texo-rojo'
                    }`}>
                      {c.completionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    'texo-azul': 'text-texo-azul dark:text-white border-texo-azul',
    'texo-verde': 'text-texo-verde border-texo-verde',
    'texo-amarillo': 'text-texo-amarillo border-texo-amarillo',
  }
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border-l-4 border border-gray-200 dark:border-gray-700 p-5 ${colorMap[color] ?? ''}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colorMap[color]?.split(' ')[0] ?? ''}`}>{value}</p>
    </div>
  )
}

function QuizAnswerDetail({ index, data }: { index: number; data: QuizDetailedAnswer }) {
  if (data.esAbierta) {
    return (
      <div className="text-sm">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base text-texo-azul dark:text-texo-amarillo">💬</span>
          <p className="font-medium text-gray-800 dark:text-gray-200">
            {index + 1}. {data.pregunta}
          </p>
        </div>
        <div className="pl-6">
          {data.respuestaAbierta ? (
            <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2 whitespace-pre-wrap">
              {data.respuestaAbierta}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">Sin respuesta.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-base ${data.esCorrecta ? 'text-texo-verde' : 'text-texo-rojo'}`}>
          {data.esCorrecta ? '✅' : '❌'}
        </span>
        <p className="font-medium text-gray-800 dark:text-gray-200">
          {index + 1}. {data.pregunta}
        </p>
      </div>
      <div className="flex flex-col gap-1 pl-6">
        {data.opciones.map((opt, oi) => {
          const selected = data.opcionesSeleccionadas.includes(oi)
          const correct = data.opcionesCorrectas.includes(oi)
          let icon = '⭕'
          let cls = 'text-gray-400 dark:text-gray-500'
          if (selected && correct) { icon = '✅'; cls = 'text-texo-verde font-semibold' }
          else if (selected && !correct) { icon = '❌'; cls = 'text-texo-rojo font-semibold' }
          else if (!selected && correct) { icon = '⭕'; cls = 'text-gray-400 dark:text-gray-500 italic' }
          return (
            <span key={oi} className={`text-xs flex items-center gap-1.5 ${cls}`}>
              <span>{icon}</span>
              {opt}
              {!selected && correct && (
                <span className="text-texo-verde text-xs not-italic">(correcta)</span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function CuestionariosView() {
  const [responses, setResponses] = useState<QuizResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/stats/quiz')
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          const parsed = (data as QuizResponse[]).map(r => ({
            ...r,
            fecha: new Date(r.fecha as unknown as string),
          }))
          setResponses(parsed)
        }
      })
      .catch(err => console.error('[quiz] error:', err))
      .finally(() => setLoading(false))
  }, [])

  const filtered = responses.filter(r =>
    r.participante.toLowerCase().includes(search.toLowerCase()) ||
    r.curso.toLowerCase().includes(search.toLowerCase()) ||
    r.recursoTitulo.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-texo-azul dark:text-white">Respuestas de cuestionarios</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hacé click en una fila para ver las respuestas completas</p>
      </div>

      <input
        type="text"
        placeholder="Buscar por participante, curso o cuestionario..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-texo-verde"
      />

      {filtered.length === 0 ? (
        <p className="text-center py-20 text-gray-500 dark:text-gray-400">
          {search ? `Sin resultados para "${search}"` : 'No hay respuestas de cuestionarios todavía.'}
        </p>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Participante</th>
                <th className="px-4 py-3 text-left">Curso</th>
                <th className="px-4 py-3 text-left">Cuestionario</th>
                <th className="px-4 py-3 text-center">Puntaje</th>
                <th className="px-4 py-3 text-center">Preguntas</th>
                <th className="px-4 py-3 text-center">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((r, idx) => {
                const rowKey = `${r.participante}-${r.recursoId}-${idx}`
                const isExpanded = expandedRow === rowKey
                const allOpen = r.respuestasDetalladas.length > 0
                  && r.respuestasDetalladas.every(d => d.esAbierta)
                const scoreColor = allOpen || r.totalPreguntas === 0
                  ? 'text-gray-400'
                  : r.score / r.totalPreguntas >= 0.7 ? 'text-texo-verde'
                  : r.score / r.totalPreguntas >= 0.4 ? 'text-texo-amarillo'
                  : 'text-texo-rojo'

                return (
                  <Fragment key={rowKey}>
                    <tr
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {r.participante.includes('@') ? r.participante.split('@')[0] : r.participante}
                        <span className="block text-xs text-gray-400 font-normal">{r.participante}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.curso}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.recursoTitulo}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${scoreColor}`}>
                          {allOpen ? '—' : `${r.score}/${r.totalPreguntas}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                        {r.respuestasDetalladas.length}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span>{r.fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                          <svg className={`w-4 h-4 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-800/40">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="flex flex-col gap-4">
                            {r.respuestasDetalladas.length > 0 ? (
                              r.respuestasDetalladas.map((d, qi) => (
                                <QuizAnswerDetail key={qi} index={qi} data={d} />
                              ))
                            ) : (
                              <p className="text-xs text-gray-400">Sin detalle disponible.</p>
                            )}
                            {r.observaciones && (
                              <div className="mt-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs font-semibold text-texo-azul dark:text-texo-amarillo uppercase tracking-wide mb-1">
                                  Observaciones del participante
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                  {r.observaciones}
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type ParticipantSortKey = 'email' | 'cursosInscritos' | 'progresoPromedio' | 'creditos' | 'ultimaActividad'

function ParticipantesView({ searchQuery }: { searchQuery: string }) {
  const [participants, setParticipants] = useState<ParticipantStats[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<ParticipantSortKey>('progresoPromedio')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [activityFilter, setActivityFilter] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/stats/participants')
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          const parsed = (data as ParticipantStats[]).map(p => ({
            ...p,
            ultimaActividad: p.ultimaActividad ? new Date(p.ultimaActividad as unknown as string) : null,
          }))
          setParticipants(parsed)
        }
      })
      .catch(err => console.error('[participants] error:', err))
      .finally(() => setLoading(false))
  }, [])

  function handleSort(key: ParticipantSortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = participants
    .filter(p => p.email.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(p => {
      if (!activityFilter) return true
      if (activityFilter === 'Muy activos') return p.progresoPromedio >= 80
      if (activityFilter === 'Activos') return p.progresoPromedio >= 50 && p.progresoPromedio < 80
      if (activityFilter === 'Poco activos') return p.progresoPromedio >= 20 && p.progresoPromedio < 50
      if (activityFilter === 'Inactivos') return p.progresoPromedio < 20
      return true
    })
    .sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      if (sortKey === 'email') { av = a.email; bv = b.email }
      else if (sortKey === 'cursosInscritos') { av = a.cursosInscritos; bv = b.cursosInscritos }
      else if (sortKey === 'progresoPromedio') { av = a.progresoPromedio; bv = b.progresoPromedio }
      else if (sortKey === 'creditos') { av = a.creditos; bv = b.creditos }
      else if (sortKey === 'ultimaActividad') { av = a.ultimaActividad?.getTime() ?? 0; bv = b.ultimaActividad?.getTime() ?? 0 }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <p className="text-center py-20 text-gray-500 dark:text-gray-400">
        {searchQuery ? `Sin resultados para "${searchQuery}"` : 'No hay participantes todavía.'}
      </p>
    )
  }

  // Datos para gráfico circular — distribución de actividad
  const activityData = [
    { name: 'Muy activos', value: participants.filter(p => p.progresoPromedio >= 80).length, color: '#3A9688' },
    { name: 'Activos', value: participants.filter(p => p.progresoPromedio >= 50 && p.progresoPromedio < 80).length, color: '#31484E' },
    { name: 'Poco activos', value: participants.filter(p => p.progresoPromedio >= 20 && p.progresoPromedio < 50).length, color: '#E8B84B' },
    { name: 'Inactivos', value: participants.filter(p => p.progresoPromedio < 20).length, color: '#C0544A' },
  ].filter(d => d.value > 0)

  // Datos para gráfico de barras — participantes por empresa (dominio del email)
  const companyMap: Record<string, number> = {}
  for (const p of participants) {
    const domain = p.email.includes('@') ? p.email.split('@')[1] : 'otro'
    const company = domain.split('.')[0].toUpperCase()
    companyMap[company] = (companyMap[company] || 0) + 1
  }
  const companyData = Object.entries(companyMap).map(([name, value]) => ({ name, value }))

  return (
    <div className="flex flex-col gap-6">
      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PieChart — distribución de actividad */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Distribución de actividad</h3>
            {activityFilter && (
              <button
                onClick={() => setActivityFilter(null)}
                className="text-xs text-texo-amarillo border border-texo-amarillo/40 px-2 py-0.5 rounded-full hover:bg-texo-amarillo/10 transition-colors"
              >
                {activityFilter} ✕
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">Click en un sector para filtrar la tabla</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={activityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={80}
                onClick={(d) => setActivityFilter(activityFilter === d.name ? null : d.name)}
                style={{ cursor: 'pointer' }}
              >
                {activityData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    opacity={activityFilter && activityFilter !== entry.name ? 0.35 : 1}
                  />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    'Muy activos': 'Muy activos (>80%)',
                    'Activos': 'Activos (50-80%)',
                    'Poco activos': 'Poco activos (20-50%)',
                    'Inactivos': 'Inactivos (<20%)',
                  }
                  return labels[value] ?? value
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* BarChart — participantes por empresa */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Participantes por empresa</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={companyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" name="Participantes" fill="#31484E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla */}
      {activityFilter && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Mostrando <span className="font-semibold text-texo-amarillo">{activityFilter}</span> — {filtered.length} participante{filtered.length !== 1 ? 's' : ''}
        </p>
      )}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-xs">
          <tr>
            {([
              ['email', 'Participante', 'left'],
              ['cursosInscritos', 'Cursos inscritos', 'center'],
              ['progresoPromedio', 'Progreso %', 'center'],
              ['creditos', 'Créditos 🎟️', 'center'],
              ['ultimaActividad', 'Última actividad', 'center'],
            ] as [ParticipantSortKey, string, string][]).map(([key, label, align]) => (
              <th
                key={key}
                className={`px-4 py-3 text-${align} cursor-pointer select-none hover:text-texo-amarillo transition-colors`}
                onClick={() => handleSort(key)}
              >
                <span className="inline-flex items-center gap-1 justify-center">
                  {label}
                  <span className="text-gray-400">
                    {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {filtered.map(p => (
            <tr key={p.email} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                {p.email.includes('@') ? p.email.split('@')[0] : p.email || '—'}
                <span className="block text-xs text-gray-400 font-normal">{p.email || ''}</span>
              </td>
              <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{p.cursosInscritos}</td>
              <td className="px-4 py-3 text-center">
                <span className={`font-semibold ${
                  p.progresoPromedio >= 70 ? 'text-texo-verde'
                  : p.progresoPromedio >= 40 ? 'text-texo-amarillo'
                  : 'text-texo-rojo'
                }`}>
                  {p.progresoPromedio}%
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                {p.creditos > 0 ? (
                  <span className="inline-flex items-center gap-1 bg-texo-amarillo/20 text-texo-azul dark:text-texo-amarillo font-bold text-xs px-2 py-1 rounded-full">
                    🎟️ {p.creditos}
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 text-xs">
                {p.ultimaActividad
                  ? p.ultimaActividad.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
