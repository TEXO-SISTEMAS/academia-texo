import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VALID_ROLES = ["artesano", "participante"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

function isValidRole(role: string | undefined): role is ValidRole {
  return VALID_ROLES.includes(role as ValidRole);
}

export function middleware(request: NextRequest) {
  const rawRole = request.cookies.get("user-role")?.value;
  const { pathname } = request.nextUrl;

  // Si la cookie existe pero contiene un valor inválido, limpiarla y redirigir
  // a /login para evitar un loop de redirección infinita.
  if (rawRole !== undefined && !isValidRole(rawRole)) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("user-role");
    return response;
  }

  const role = rawRole as ValidRole | undefined;

  // Ruta raíz: siempre va a login (login redirige al dashboard si ya hay sesión)
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Ruta de login: si ya está autenticado, redirigir al lugar correcto
  if (pathname.startsWith("/login")) {
    if (role) {
      return NextResponse.redirect(
        new URL(
          role === "artesano" ? "/artesano/dashboard" : "/bienvenida",
          request.url
        )
      );
    }
    return NextResponse.next();
  }

  // Rutas protegidas: requieren autenticación
  if (!role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Ruta admin: solo artesanos (la página verifica el email exacto)
  if (pathname.startsWith("/admin") && role !== "artesano") {
    return NextResponse.redirect(
      new URL(role === "participante" ? "/participante/dashboard" : "/login", request.url)
    );
  }

  // Acceso por rol: artesanos no acceden a rutas de participante y viceversa
  if (pathname.startsWith("/artesano") && role !== "artesano") {
    return NextResponse.redirect(
      new URL("/participante/dashboard", request.url)
    );
  }

  if (
    (pathname.startsWith("/participante") || pathname.startsWith("/bienvenida")) &&
    role !== "participante"
  ) {
    return NextResponse.redirect(
      new URL("/artesano/dashboard", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|.*\\.webp).*)",
  ],
};
