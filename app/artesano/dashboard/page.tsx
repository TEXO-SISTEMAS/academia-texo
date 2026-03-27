'use client'

import { useState, useEffect, useCallback } from 'react'
import { getArtesanoCourses, type CourseStats } from '@/lib/stats'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export default function ArtesanoDashboard() {
  const [activeTab, setActiveTab] = useState<'propedeuticos' | 'participantes'>('propedeuticos')
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
      </div>

      {/* Buscador */}
      <div className="mb-6">
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
      </div>

      {activeTab === 'propedeuticos' ? (
        <PropedeuticosView searchQuery={searchQuery} />
      ) : (
        <ParticipantesView searchQuery={searchQuery} />
      )}
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
            Inscriptos vs Completaron
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Inscriptos" fill="#31484E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Completaron" fill="#E8B84B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-center py-10">
          No hay propedéuticos publicados todavía.
        </p>
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

function ParticipantesView({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="text-center py-20 text-gray-500 dark:text-gray-400">
      <p className="text-lg font-semibold mb-2">Vista por Participante</p>
      <p className="text-sm">En construcción...</p>
      {searchQuery && <p className="text-xs mt-2 opacity-60">Búsqueda: &quot;{searchQuery}&quot;</p>}
    </div>
  )
}
