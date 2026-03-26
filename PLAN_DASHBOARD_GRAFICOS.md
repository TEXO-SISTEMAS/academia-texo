# Plan: Dashboard de Gráficos — Academia TEXO

Generado: 2026-03-26
Commit base: `ae8a7b0`

---

## 1. Estado Actual del Proyecto

### ✅ Funciona
- Auth completa (participantes magic link, artesanos password, admin)
- Redirect por rol desde login: admin→/admin, artesano→/artesano/dashboard, participante→/participante/dashboard
- Panel artesano: crear/editar/archivar cursos, capítulos, recursos
- Upload resumable a Google Drive para todos los tipos (fix 413 aplicado)
- Panel participante: ver cursos, progreso secuencial bloqueado
- Panel admin: Auditoría, Contenido archivado, Usuarios
- Firestore rules simplificadas (sin get() en courses)
- Timers por página: 20s (reducido de 60s)

### ❌ Falta
- Dashboard de gráficos para el admin (inscripciones, progreso, actividad)
- Vista de progreso por curso en panel artesano
- Los logs de debug del auth (auth-context.tsx, bienvenida/page.tsx) están pendientes de limpiar

### ⚠️ Riesgo principal: Quota Firestore
Las funciones `getCoursesProgressSummary` y `getCourseProgressSummary` en `lib/firestore.ts`
usan `collectionGroup("courses")` + múltiples lecturas anidadas. Con muchos participantes
pueden generar cientos de lecturas por request. **NO llamar estas funciones en un loop
ni en el dashboard de cada artesano sin paginación.**

---

## 2. Arquitectura de Datos en Firestore

```
/courses/{courseId}
  title, description, published, courseNumber, createdBy, deleted

/courses/{courseId}/chapters/{chapterId}
  title, description, orderIndex, deleted

/courses/{courseId}/chapters/{chapterId}/resources/{resourceId}
  title, type, content, orderIndex, deleted

/progress/{userId}/courses/{courseId}
  enrolledAt, courseId, userId, totalTimeSpent

/progress/{userId}/courses/{courseId}/resources/{resourceId}
  completed, completedAt, score, timeSpent,
  pagesViewed[], videoWatchedSeconds, readingComplete

/users/{uid}
  role, email, displayName, createdAt, lastLoginAt, loginCount

/allowedUsers/{email}
  name, role

/auditLog/{auto-id}
  type, userId, userEmail, action, resourceType, resourceTitle, timestamp

/loginHistory/{userId}/sessions/{auto-id}
  loginAt, userAgent
```

### Funciones ya disponibles en lib/firestore.ts

| Función | Qué retorna | Costo estimado |
|---|---|---|
| `getAllParticipants()` | User[] con role=participante | 1 query |
| `getParticipantProgress(userId)` | ParticipantCourseStat[] | 1 + N lecturas |
| `getCourseProgressStats(userId, courseId)` | {completed, total, enrolled} | 3-5 lecturas |
| `getCourseProgressSummary(courseId)` | ParticipantProgressSummary[] | ⚠️ collectionGroup + N lecturas |
| `getCoursesProgressSummary(artesanoId)` | CourseProgressSummaryItem[] | ⚠️ collectionGroup por curso |
| `getAuditLogs(pageSize, cursor)` | AuditLogEntry[] paginado | 1 query |
| `getCoursesByArtesano(artesanoId)` | Course[] | 1 query |
| `getAllPublishedCourses()` | Course[] | 1 query |

---

## 3. Plan Detallado — Dashboard de Gráficos

### Arquitectura propuesta

El dashboard se agrega como **Tab 4 "Progreso"** en `/app/admin/page.tsx`.
Usa `getCoursesProgressSummary` que ya existe pero con **protección de quota**:
cargar solo al hacer click en el tab, no automáticamente.

### Paso 1 — Agregar tab en admin/page.tsx

Modificar el array `TABS`:

```tsx
// En /app/admin/page.tsx, línea ~437
const TABS: { id: TabId; label: string }[] = [
  { id: "audit",    label: "Auditoría" },
  { id: "archived", label: "Contenido archivado" },
  { id: "users",    label: "Usuarios" },
  { id: "progress", label: "Progreso" },  // ← agregar
];
type TabId = "audit" | "archived" | "users" | "progress";
```

Y agregar render del tab:

```tsx
{activeTab === "progress" && <ProgressTab adminEmail={ADMIN_EMAIL} />}
```

### Paso 2 — Componente ProgressTab (sin librería de charts)

Usar barras CSS puras para evitar dependencias externas:

```tsx
function ProgressTab({ adminEmail }: { adminEmail: string }) {
  const { firebaseUser } = useAuth();
  const [data, setData] = useState<CourseProgressSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // getCoursesProgressSummary espera artesanoId pero admin ve todos los cursos
      // Ver Paso 3 para la función getAllCoursesProgressSummary
      const result = await getAllCoursesProgressSummary();
      setData(result);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  if (!loaded) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm mb-4">
          Cargá el reporte de progreso bajo demanda para evitar lecturas excesivas.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-texo-amarillo text-texo-azul font-semibold rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Cargar reporte"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen global */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Cursos publicados" value={data.filter(c => c.published).length} />
        <StatCard label="Total inscripciones" value={data.reduce((a, c) => a + c.totalEnrolled, 0)} />
        <StatCard label="Progreso promedio" value={`${Math.round(data.reduce((a, c) => a + c.avgProgress, 0) / (data.length || 1))}%`} />
        <StatCard label="Cursos con actividad" value={data.filter(c => c.totalEnrolled > 0).length} />
      </div>

      {/* Tabla con barra de progreso por curso */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Propedéutico</th>
              <th className="px-4 py-2.5 text-left font-medium">Inscriptos</th>
              <th className="px-4 py-2.5 text-left font-medium">Progreso promedio</th>
              <th className="px-4 py-2.5 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.map((course) => (
              <tr key={course.courseId} className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white text-xs">{course.title}</p>
                  {course.courseNumber && (
                    <p className="text-xs text-texo-amarillo">N° {course.courseNumber}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                  {course.totalEnrolled}
                </td>
                <td className="px-4 py-3 w-48">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-texo-verde h-2 rounded-full transition-all"
                        style={{ width: `${course.avgProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8">{course.avgProgress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    course.published
                      ? "bg-texo-verde/10 text-texo-verde"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  }`}>
                    {course.published ? "Publicado" : "Borrador"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={load}
        disabled={loading}
        className="text-sm text-texo-verde hover:underline disabled:opacity-50"
      >
        {loading ? "Actualizando..." : "↻ Actualizar"}
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}
```

### Paso 3 — Nueva función en lib/firestore.ts

`getCoursesProgressSummary` requiere un `artesanoId`. Para el admin necesitamos una variante que lea todos los cursos publicados:

```ts
// Agregar en lib/firestore.ts

export async function getAllCoursesProgressSummary(): Promise<CourseProgressSummaryItem[]> {
  const allCourses = await getAllPublishedCourses();

  return Promise.all(
    allCourses.map(async (course) => {
      // Contar recursos totales
      const chaptersSnap = await getDocs(collection(db, "courses", course.id, "chapters"));
      const resourceCounts = await Promise.all(
        chaptersSnap.docs
          .filter(d => d.data().deleted !== true)
          .map((ch) =>
            getDocs(collection(db, "courses", course.id, "chapters", ch.id, "resources"))
              .then((s) => s.docs.filter(d => d.data().deleted !== true).length)
          )
      );
      const totalResources = resourceCounts.reduce((acc, n) => acc + n, 0);

      // Inscripciones usando collectionGroup
      const enrollQuery = query(
        collectionGroup(db, "courses"),
        where("courseId", "==", course.id)
      );
      const enrollSnap = await getDocs(enrollQuery);
      const totalEnrolled = enrollSnap.size;

      if (totalEnrolled === 0 || totalResources === 0) {
        return {
          courseId: course.id,
          title: course.title,
          courseNumber: course.courseNumber,
          published: course.published,
          totalEnrolled,
          avgProgress: 0,
          enrollments: [],
        };
      }

      // Calcular progreso por participante
      const progressData = await Promise.all(
        enrollSnap.docs.map(async (enrollDoc) => {
          const { userId, enrolledAt } = enrollDoc.data() as {
            userId: string;
            enrolledAt: CourseEnrollment["enrolledAt"];
          };
          const progressSnap = await getDocs(
            collection(db, "progress", userId, "courses", course.id, "resources")
          );
          const completed = progressSnap.docs.filter((d) => d.data().completed === true).length;
          return { userId, enrolledAt, completed };
        })
      );

      const avgProgress =
        totalResources > 0
          ? Math.round(
              progressData.reduce((acc, p) => acc + (p.completed / totalResources) * 100, 0) /
                totalEnrolled
            )
          : 0;

      return {
        courseId: course.id,
        title: course.title,
        courseNumber: course.courseNumber,
        published: course.published,
        totalEnrolled,
        avgProgress,
        enrollments: progressData.map(({ userId, enrolledAt }) => ({ userId, enrolledAt })),
      };
    })
  );
}
```

### Paso 4 — Tipos necesarios en types/index.ts

Verificar que `CourseProgressSummaryItem` esté exportado (ya existe en firestore.ts, puede necesitarse en el componente):

```ts
// En types/index.ts (si no existe ya):
export interface CourseProgressSummaryItem {
  courseId: string;
  title: string;
  courseNumber?: number;
  published: boolean;
  totalEnrolled: number;
  avgProgress: number;
  enrollments: { userId: string; enrolledAt: Timestamp | null }[];
}
```

---

## 4. Queries de Firestore Necesarias

### Query 1 — Todos los cursos publicados (1 lectura)
```ts
query(collection(db, "courses"), where("published", "==", true), orderBy("createdAt", "desc"))
```

### Query 2 — Inscripciones por curso (1 query collectionGroup)
```ts
query(collectionGroup(db, "courses"), where("courseId", "==", courseId))
```
⚠️ Requiere index en Firebase Console:
- Collection: `courses` (collectionGroup)
- Fields: `courseId ASC`

### Query 3 — Recursos completados por participante (1 query por participante)
```ts
collection(db, "progress", userId, "courses", courseId, "resources")
// filtrar en cliente: d.data().completed === true
```

### Query 4 — Capítulos y recursos de un curso (2 queries)
```ts
collection(db, "courses", courseId, "chapters")
collection(db, "courses", courseId, "chapters", chapterId, "resources")
```

### Estimación de lecturas por carga del dashboard
Con C cursos, P participantes promedio por curso, R recursos promedio:
- C × 1 (chapters query) + C × avgChapters (resources queries) + C × P (progress queries)
- Ejemplo: 5 cursos × 3 capítulos × 5 recursos = 5 + 15 + 5×3 = **35 lecturas** (aceptable)
- Ejemplo con 50 participantes por curso: 5 + 15 + 5×50 = **270 lecturas** (alto, usar bajo demanda)

**Por eso el botón "Cargar reporte" es clave — no cargar automáticamente.**

---

## 5. Índices de Firestore Necesarios

Crear en Firebase Console → Firestore → Indexes:

### Index 1 (collectionGroup) — para inscripciones
- Collection group: `courses`
- Fields: `courseId` (Ascending)
- Query scope: Collection group

### Index 2 — para cursos publicados ordenados
- Collection: `courses`
- Fields: `published` (Ascending), `createdAt` (Descending)
- Query scope: Collection

(Este index puede ya existir si se usó antes `getAllPublishedCourses`)

---

## 6. Prompts para Claude (sin Claude Code)

### PROMPT A — Agregar función getAllCoursesProgressSummary

```
En el archivo lib/firestore.ts de un proyecto Next.js 14 con Firebase/Firestore,
agregar la siguiente función al final del archivo (antes de la última llave):

[pegar el código del Paso 3 de este documento]

La función ya tiene disponible en el archivo:
- collectionGroup, getDocs, collection, query, where importados de firebase/firestore
- getAllPublishedCourses() definida en el mismo archivo
- El tipo CourseEnrollment importado de @/types
- La interfaz CourseProgressSummaryItem ya definida en el mismo archivo

No modificar nada más del archivo.
```

### PROMPT B — Agregar tab Progreso en admin/page.tsx

```
En el archivo app/admin/page.tsx de un proyecto Next.js 14:

1. Cambiar el tipo TabId de:
   type TabId = "audit" | "archived" | "users"
   a:
   type TabId = "audit" | "archived" | "users" | "progress"

2. Agregar al array TABS:
   { id: "progress", label: "Progreso" }

3. Agregar import al inicio:
   import { getAllCoursesProgressSummary } from "@/lib/firestore"
   import type { CourseProgressSummaryItem } from "@/lib/firestore"

4. Agregar al final del archivo (antes del export default) el componente ProgressTab:
   [pegar código del Paso 2]

5. En el JSX del componente AdminPage, después de:
   {activeTab === "users" && <UsersTab />}
   Agregar:
   {activeTab === "progress" && <ProgressTab />}

No modificar nada más del archivo.
```

### PROMPT C — Limpiar logs de debug

```
En los siguientes archivos de un proyecto Next.js 14, eliminar TODOS los console.log
que empiecen con "[LOGIN]", "[BIENVENIDA]" o "[verify]":

1. lib/auth-context.tsx — eliminar los console.log agregados en la función login()
2. app/bienvenida/page.tsx — eliminar los console.log al inicio del componente
   y dentro del useEffect
3. app/api/auth/verify/route.ts — eliminar los console.log de debug duplicados
   (mantener solo el que loguea el email y role, eliminar los redundantes)

No modificar ninguna lógica, solo remover los console.log de debug.
```

### PROMPT D — Proteger dashboard participante del quota

```
En app/participante/dashboard/page.tsx, la función load() llama
getCourseProgressStats(firebaseUser.uid, course.id) para cada curso publicado.

Esto genera N lecturas por cada carga del dashboard.

Modificar para que:
1. Los cursos se muestren primero sin stats (progressPct=undefined)
2. Las stats se carguen en segundo plano con Promise.allSettled (no Promise.all)
3. Si falla una stat individual, no rompe todo el dashboard — ese curso muestra
   barra vacía

El componente CourseCard ya acepta progressPct=undefined y muestra la card sin barra.
```

---

## 7. Orden de Implementación Recomendado

1. **Limpiar debug logs** (Prompt C) — bajo riesgo, sin funcionalidad nueva
2. **Agregar función getAllCoursesProgressSummary** (Prompt A) — solo lib/firestore.ts
3. **Agregar tab Progreso** (Prompt B) — funcionalidad nueva, bajo demanda
4. **Crear índices en Firebase Console** — necesario para que funcionen las queries
5. **Proteger dashboard participante** (Prompt D) — mejora de performance

---

## 8. Notas Técnicas Importantes

- **No usar `collectionGroup` automáticamente en componentes que se montan solos.**
  Siempre detrás de un botón o acción del usuario.

- **El artesano también puede tener su propio dashboard de progreso** usando
  `getCoursesProgressSummary(firebaseUser.uid)` que ya existe y filtra por artesanoId.
  Se puede agregar como tab en `/app/artesano/cursos/[courseId]/page.tsx`.

- **Recharts vs barras CSS**: Para evitar bundle size extra y problemas de SSR,
  las barras CSS puras son suficientes para este caso. Si se quiere un gráfico de
  líneas para actividad temporal, usar `recharts` (`npm install recharts`).

- **Cookie user-role**: La cookie se setea server-side en `/api/auth/verify` y
  client-side en `auth-context.tsx`. Si hay inconsistencia, el server-side gana
  porque llega antes de `signInWithCustomToken`.

- **Firestore rules actuales** (cursos): `allow read, write: if request.auth != null`
  — cualquier usuario autenticado puede leer/escribir cursos. Suficiente para
  desarrollo, refinar antes de producción masiva.
