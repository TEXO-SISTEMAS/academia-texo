"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import {
  getAuditLogs,
  getArchivedCourses,
  restoreCourse,
  getAllowedUsers,
  addAllowedUser,
  removeAllowedUser,
} from "@/lib/firestore";
import type { AuditCursor } from "@/lib/firestore";
import type { AuditLogEntry, AllowedUser, Course, UserRole } from "@/types";
import { Timestamp } from "firebase/firestore";

const ADMIN_EMAIL = "danilo.sosa@texo.com.py";
const PAGE_SIZE = 20;

function timeAgo(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts.toMillis();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleString("es-PY", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Tab 1: Auditoría ──────────────────────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<AuditCursor | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { logs: newLogs, nextCursor } = await getAuditLogs(PAGE_SIZE);
      setLogs(newLogs);
      setCursor(nextCursor);
      setHasMore(newLogs.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const { logs: newLogs, nextCursor } = await getAuditLogs(PAGE_SIZE, cursor);
      setLogs((prev) => [...prev, ...newLogs]);
      setCursor(nextCursor);
      setHasMore(newLogs.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = search.trim()
    ? logs.filter((l) =>
        (l.userEmail || l.userId).toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por usuario o acción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">Sin resultados.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Fecha</th>
                  <th className="px-4 py-2.5 text-left font-medium">Usuario</th>
                  <th className="px-4 py-2.5 text-left font-medium">Acción</th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((log) => (
                  <tr key={log.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="text-gray-900 dark:text-white text-xs font-medium">{timeAgo(log.timestamp)}</span>
                      <span className="block text-xs text-gray-400">{formatDate(log.timestamp)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 max-w-[160px] truncate text-xs">
                      {log.userEmail || log.userId}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 max-w-[280px] text-xs">
                      {log.action}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {log.resourceType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && !search.trim() && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 text-sm text-texo-verde hover:underline disabled:opacity-50"
            >
              {loadingMore ? "Cargando..." : "Cargar más →"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab 2: Contenido archivado ────────────────────────────────────────────────

function ArchivedTab() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    getArchivedCourses()
      .then(setCourses)
      .finally(() => setLoading(false));
  }, []);

  async function handleRestore(courseId: string, title: string) {
    setRestoringId(courseId);
    try {
      await restoreCourse(courseId);
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
      toast.success(`"${title}" restaurado`);
    } catch {
      toast.error("Error al restaurar. Intentá de nuevo.");
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      ))}
    </div>
  );

  if (courses.length === 0) return (
    <p className="text-gray-400 text-sm py-8 text-center">No hay contenido archivado.</p>
  );

  return (
    <ul className="flex flex-col gap-3">
      {courses.map((course) => (
        <li
          key={course.id}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{course.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">Artesano: {course.createdBy}</p>
          </div>
          <button
            onClick={() => handleRestore(course.id, course.title)}
            disabled={restoringId === course.id}
            className="shrink-0 text-sm px-3 py-1.5 bg-texo-verde/10 text-texo-verde rounded-lg hover:bg-texo-verde/20 transition-colors disabled:opacity-50 font-medium"
          >
            {restoringId === course.id ? "Restaurando..." : "Restaurar"}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Tab 3: Usuarios ───────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [showModal, setShowModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("participante");
  const [saving, setSaving] = useState(false);
  const [addedArtesano, setAddedArtesano] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllowedUsers();
      setUsers(data.sort((a, b) => a.id.localeCompare(b.id)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleAdd() {
    if (!newEmail.trim() || !newName.trim()) return;
    setSaving(true);
    try {
      await addAllowedUser(newEmail.trim().toLowerCase(), newName.trim(), newRole);
      await loadUsers();
      setAddedArtesano(newRole === "artesano");
      setNewEmail("");
      setNewName("");
      setNewRole("participante");
      if (newRole !== "artesano") {
        setShowModal(false);
        toast.success("Usuario agregado");
      }
    } catch {
      toast.error("Error al agregar usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(uid: string) {
    setRemovingId(uid);
    try {
      await removeAllowedUser(uid);
      setUsers((prev) => prev.filter((u) => u.id !== uid));
      toast.success("Usuario eliminado");
    } catch {
      toast.error("Error al eliminar usuario.");
    } finally {
      setRemovingId(null);
    }
  }

  const filtered = roleFilter === "all" ? users : users.filter((u) => u.role === roleFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-2">
          {(["all", "participante", "artesano"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                roleFilter === r
                  ? "bg-texo-amarillo text-texo-azul"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {r === "all" ? "Todos" : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setShowModal(true); setAddedArtesano(false); }}
          className="text-sm px-4 py-1.5 bg-texo-amarillo text-texo-azul font-semibold rounded-lg hover:bg-texo-amarillo/90 transition-colors"
        >
          + Agregar usuario
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">Sin usuarios.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-left font-medium">Nombre</th>
                <th className="px-4 py-2.5 text-left font-medium">Rol</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((user) => (
                <tr key={user.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 max-w-[220px] truncate text-xs">{user.id}</td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs">{user.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      user.role === "artesano"
                        ? "bg-texo-amarillo/20 text-texo-amarillo"
                        : "bg-texo-verde/10 text-texo-verde"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleRemove(user.id)}
                      disabled={removingId === user.id || user.id === ADMIN_EMAIL}
                      className="text-xs text-texo-rojo hover:underline disabled:opacity-30"
                      title={user.id === ADMIN_EMAIL ? "No se puede eliminar el admin" : "Eliminar"}
                    >
                      {removingId === user.id ? "..." : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Agregar usuario</h3>
            {addedArtesano ? (
              <div>
                <div className="bg-texo-amarillo/10 border border-texo-amarillo/30 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-texo-amarillo mb-1">⚠️ Paso adicional requerido</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Recordá crear el usuario en{" "}
                    <strong>Firebase Console → Authentication</strong>{" "}
                    con el mismo email y la contraseña que le asignés.
                  </p>
                </div>
                <button
                  onClick={() => { setShowModal(false); setAddedArtesano(false); }}
                  className="w-full py-2 bg-texo-amarillo text-texo-azul font-semibold rounded-xl text-sm hover:bg-texo-amarillo/90 transition-colors"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="usuario@texo.com.py"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rol</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="participante">Participante</option>
                    <option value="artesano">Artesano</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={saving || !newEmail.trim() || !newName.trim()}
                    className="flex-1 py-2 bg-texo-amarillo text-texo-azul font-semibold rounded-xl text-sm disabled:opacity-50 hover:bg-texo-amarillo/90 transition-colors"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type TabId = "audit" | "archived" | "users";
const TABS: { id: TabId; label: string }[] = [
  { id: "audit", label: "Auditoría" },
  { id: "archived", label: "Contenido archivado" },
  { id: "users", label: "Usuarios" },
];

export default function AdminPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("audit");

  const isAdmin =
    firebaseUser?.uid === ADMIN_EMAIL ||
    firebaseUser?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) router.replace("/login");
  }, [loading, isAdmin, router]);

  if (loading || !firebaseUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-texo-verde/30 border-t-texo-verde rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 border-b-[3px] border-texo-amarillo inline-block mb-6">
        Panel de administración
      </h1>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-texo-amarillo text-gray-900 dark:text-white"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "audit" && <AuditTab />}
      {activeTab === "archived" && <ArchivedTab />}
      {activeTab === "users" && <UsersTab />}
    </div>
  );
}
