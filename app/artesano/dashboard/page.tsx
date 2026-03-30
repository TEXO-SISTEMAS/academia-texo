'use client'

import { useState, useEffect, useCallback } from 'react'
import { getArtesanoCourses, getAllParticipants, type CourseStats, type ParticipantStats } from '@/lib/stats'
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
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getArtesanoCourses()
      setCourses(data)
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
              <Tooltip />
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

function CuestionariosView() {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-bold text-texo-azul dark:text-white">Respuestas de cuestionarios</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">Respuestas y calificaciones de los participantes</p>
      <p className="mt-8 text-center text-gray-400 dark:text-gray-600 text-sm">Vista en construcción...</p>
    </div>
  )
}

function ParticipantesView({ searchQuery }: { searchQuery: string }) {
  const [participants, setParticipants] = useState<ParticipantStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllParticipants()
      .then(setParticipants)
      .finally(() => setLoading(false))
  }, [])

  const filtered = participants.filter(p =>
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Distribución de actividad</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={activityData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={80}>
                {activityData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
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
              <Tooltip />
              <Bar dataKey="value" name="Participantes" fill="#31484E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Participante</th>
            <th className="px-4 py-3 text-center">Cursos inscritos</th>
            <th className="px-4 py-3 text-center">Progreso %</th>
            <th className="px-4 py-3 text-center">Última actividad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {filtered.map(p => (
            <tr key={p.email} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                {p.email.includes('@') ? p.email.split('@')[0] : p.email}
                <span className="block text-xs text-gray-400 font-normal">{p.email}</span>
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
