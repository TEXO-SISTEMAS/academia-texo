# CONTEXTO.md — Academia TEXO: Plataforma de Autoformación

## 1. DESCRIPCIÓN DEL PROYECTO

Plataforma web de autoformación interna para el Grupo TEXO (industria publicitaria, marketing y medios de Paraguay). Permite a colaboradores y líderes formarse a través de cursos estructurados con contenido multimedia y progreso secuencial bloqueado. El primer curso es el **Propedéutico 2026**, basado en el glosario institucional de TEXO.

---

## 2. PROBLEMA QUE RESUELVE

Digitalizar la formación interna de TEXO, hoy dispersa en encuentros presenciales y materiales sueltos. La plataforma permite que cada colaborador avance a su propio ritmo desde cualquier dispositivo, y que los Artesanos (docentes internos) gestionen sus propios cursos sin depender de soporte técnico.

---

## 3. USUARIOS Y ROLES

### Participante
- Colaborador o líder del Grupo TEXO
- Se registra con su correo institucional
- Accede a los cursos disponibles
- Avanza recurso por recurso dentro de cada capítulo (bloqueado secuencialmente)
- Ve su progreso por curso y por capítulo

### Artesano
- Docente interno de TEXO
- Crea y gestiona sus propios cursos
- Crea capítulos dentro de cada curso
- Carga recursos dentro de cada capítulo (video, PPT, texto, cuestionario, archivo)
- Define el orden de los recursos (ese orden determina el desbloqueo)
- Ve el progreso de los Participantes en sus cursos

### Administrador (futuro — NO implementar en MVP)
- Gestión global de usuarios, roles y reportes

---

## 4. TIPO DE APLICACIÓN

- App web responsive (desktop y móvil)
- Acceso por URL pública protegida por login
- No es app móvil nativa

---

## 5. STACK TÉCNICO

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Rutas protegidas por rol, SSR, ideal para plataformas educativas |
| Estilos | Tailwind CSS | Diseño rápido, profesional, responsive |
| Base de datos | Firebase Firestore | NoSQL flexible, gratis sin tarjeta de crédito |
| Auth | Firebase Auth — Magic Link | Login solo con correo, sin contraseña |
| Storage | Cloudinary | Para PDFs, PPTs e imágenes de portada. Cloud name: `dijx5djun`, Upload preset: `academia-texo` (Unsigned). Plan gratuito, sin tarjeta. Firebase Storage eliminado (problema con región gratuita). |
| Videos | Google Drive (link embebido) | Los videos viven en Drive; la app guarda el link e incrusta el reproductor |
| Deploy | Vercel | Gratis, deploy automático desde GitHub |

**Importante:** ninguno de estos servicios requiere tarjeta de crédito para el plan gratuito.

---

## 6. AUTENTICACIÓN

- **Método:** Magic Link (Firebase Auth)
- **Flujo:** El usuario ingresa su correo → recibe un email con link de acceso → entra directo sin contraseña
- **Restricción MVP:** cualquier correo puede registrarse (validación por dominio @texo se agrega en iteración siguiente)
- **Roles:** guardados en colección `users` de Firestore con campo `role: 'participante' | 'artesano'`
- **Dark/Light mode:** botón toggle en la navbar, preferencia guardada en localStorage

---

## 7. JERARQUÍA DE CONTENIDO

```
Curso
  └── Capítulo 1
        └── Recurso 1 — ej: Video        (desbloqueado por defecto)
        └── Recurso 2 — ej: PPT          (se desbloquea al completar Recurso 1)
        └── Recurso 3 — ej: Cuestionario (se desbloquea al completar Recurso 2)
  └── Capítulo 2 (se desbloquea al completar TODOS los recursos del Capítulo 1)
  └── Capítulo 3 ...
```

**Regla de desbloqueo:**
- Dentro de un capítulo: el Participante completa cada recurso en orden para acceder al siguiente
- Entre capítulos: debe completar TODOS los recursos del capítulo actual para desbloquear el siguiente
- El primer recurso del primer capítulo siempre está desbloqueado

---

## 8. TIPOS DE RECURSOS

| Tipo | Descripción | Cómo se completa |
|---|---|---|
| Video | Link de Google Drive, embebido como iframe | Botón "Marcar como visto" |
| Presentación | Link de Google Drive (PPT/Slides), embebido como iframe | Botón "Marcar como visto" |
| Texto | Contenido escrito en el editor del panel Artesano | Botón "Marcar como leído" |
| Cuestionario | Preguntas de selección múltiple (1 a 10 preguntas) | Al enviar respuestas (cualquier puntaje completa en MVP) |
| Archivo | PDF u otro archivo, subido a Cloudinary | Botón "Marcar como descargado" |

---

## 9. ESTRUCTURA DE FIRESTORE

```
/users/{userId}
  - email: string
  - displayName: string
  - role: 'participante' | 'artesano'
  - createdAt: timestamp

/courses/{courseId}
  - title: string
  - description: string
  - coverImageUrl: string (opcional)
  - createdBy: userId
  - createdAt: timestamp
  - published: boolean

/courses/{courseId}/chapters/{chapterId}
  - title: string
  - description: string
  - orderIndex: number
  - createdAt: timestamp

/courses/{courseId}/chapters/{chapterId}/resources/{resourceId}
  - title: string
  - type: 'video' | 'presentation' | 'text' | 'quiz' | 'file'
  - orderIndex: number
  - content: object (varía según type)
      video:        { driveUrl: string }
      presentation: { driveUrl: string }
      text:         { body: string }
      quiz:         { questions: [{ questionText: string, options: string[], correctIndex: number }] }
      file:         { storageUrl: string, fileName: string }
  - createdAt: timestamp

/progress/{userId}/courses/{courseId}
  - enrolledAt: timestamp

/progress/{userId}/courses/{courseId}/resources/{resourceId}
  - completed: boolean
  - completedAt: timestamp
  - score: number (solo para quiz: cantidad de respuestas correctas)
```

---

## 10. PANEL DEL ARTESANO

- Lista de sus cursos con opción de crear nuevo
- Crear / editar curso: título, descripción, imagen de portada, publicar/despublicar
- Dentro de un curso: crear / editar / reordenar capítulos
- Dentro de un capítulo: agregar / editar / reordenar recursos de cualquier tipo
- Ver progreso de Participantes por curso (tabla: nombre, capítulo actual, % completado)

---

## 11. PANEL DEL PARTICIPANTE

- Pantalla de inicio: lista de cursos disponibles con portada, título y % de progreso
- Vista de curso: índice de capítulos (bloqueados/desbloqueados) + barra de progreso horizontal
- Vista de capítulo: lista de recursos con estado (✓ completado / activo / 🔒 bloqueado)
- Vista de recurso: contenido embebido + botón de completar según tipo
- Al completar un recurso: el siguiente se desbloquea automáticamente sin recargar la página

---

## 12. DISEÑO VISUAL

### Paleta de colores (extraída del branding oficial de Academia TEXO)
```css
--texo-amarillo:    #E8B84B  /* botones primarios, acentos, logo */
--texo-verde:       #3A9688  /* progreso, completado, éxito     */
--texo-rojo:        #C0544A  /* errores, alertas                */
--texo-azul-oscuro: #31484E  /* navbar, header, base oscura     */
```

### Estructura de pantalla
- **Navbar:** fondo `#31484E`, logo Academia TEXO (PNG/SVG proporcionado), nombre del usuario, toggle dark/light
- **Barra de progreso:** horizontal debajo del navbar, color `#3A9688`, muestra "X de Y capítulos completados"
- **Índice lateral:** capítulos con íconos de estado, colapsa a menú hamburguesa en móvil (< 768px)
- **Área de contenido:** recursos con tabs por tipo cuando hay más de uno en el capítulo

### Modo oscuro / claro
- Toggle en la navbar, implementado con `next-themes`
- Tailwind `dark:` classes en todos los componentes
- `class="dark"` en el elemento `<html>`

### Responsive
- Mobile-first
- Breakpoint principal: 768px
- En móvil: índice lateral colapsa, recursos en columna única

### Inspiración visual
- Platzi / LinkedIn Learning: profesional, limpio, moderno, tipografía clara

---

## 13. LO QUE NO INCLUYE EL MVP

- Validación de dominio @texo en el login
- Sistema de créditos académicos
- Certificados de finalización
- Múltiples Artesanos por curso
- Rol de Administrador global
- Reportes y analytics avanzados
- Notificaciones de progreso por email
- Puntaje mínimo para aprobar (cualquier envío completa el recurso en MVP)
- Subida automática a Google Drive (MVP usa links pegados a mano)
- Comentarios o foros por capítulo
- Búsqueda de cursos

---

## 14. DEPLOY Y ENTORNO

- Repositorio: GitHub (privado)
- Deploy: Vercel (conectado a GitHub, deploy automático en cada push a `main`)
- Base de datos y auth: Firebase proyecto gratuito (plan Spark — sin tarjeta de crédito)
- Storage de archivos: Cloudinary plan gratuito (sin tarjeta de crédito)

### Variables de entorno (.env.local)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dijx5djun
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=academia-texo
```

---

## 15. CONSIDERACIONES TÉCNICAS PARA CLAUDE CODE

- Usar Next.js App Router (no Pages Router)
- Rutas protegidas con `middleware.ts` que verifica sesión Firebase
- Organizar rutas en `/app/(participante)/` y `/app/(artesano)/` con layouts separados
- Firestore Security Rules: Participante solo lee/escribe su propio progreso; Artesano solo escribe en sus propios cursos
- Tipar todos los modelos con TypeScript — no usar `any`
- Componentes del panel Artesano y Participante en carpetas completamente separadas
- Dark/light mode con `next-themes`
- Videos y presentaciones de Drive: embeber con iframe usando la URL de previsualización pública de Drive
- Tailwind config debe registrar los 4 colores TEXO como colores custom (`texo-amarillo`, `texo-verde`, `texo-rojo`, `texo-azul`)
- Al completar un recurso, actualizar Firestore y el estado local sin recargar la página (optimistic UI)
- Archivos (PDFs, PPTs, imágenes de portada): subir a Cloudinary con upload unsigned usando cloud name `dijx5djun` y upload preset `academia-texo`. Firebase Storage no se usa.
