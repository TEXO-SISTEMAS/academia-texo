"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getAllPublishedCourses } from "@/lib/firestore";

export default function BienvenidaPage() {
  console.log("[BIENVENIDA] COMPONENTE MONTADO");
  if (typeof document !== "undefined") {
    console.log("[BIENVENIDA] cookies:", document.cookie);
  }

  const { firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string>("");
  const [nameLoading, setNameLoading] = useState(true);
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [destHref, setDestHref] = useState<string | null>(null);

  useEffect(() => {
    // Leer role directamente de la cookie user-role (seteada en login)
    const cookies = document.cookie.split(";");
    const roleCookie = cookies.find((c) => c.trim().startsWith("user-role="));
    const role = roleCookie ? decodeURIComponent(roleCookie.split("=")[1].trim()) : null;

    console.log("[BIENVENIDA] cookies:", document.cookie);
    console.log("[BIENVENIDA] role desde cookie:", role);

    let ruta = "/participante/dashboard";
    if (role === "admin") ruta = "/admin";
    else if (role === "artesano") ruta = "/artesano/dashboard";
    else if (!role) {
      console.log("[BIENVENIDA] no hay cookie user-role, redirigiendo a /login");
      router.replace("/login");
      return;
    }

    console.log("[BIENVENIDA] redirecting to:", ruta);
    setDestHref(ruta);
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) return;

    async function fetchName() {
      const uid = firebaseUser!.uid;
      const emailFallback = uid.includes("@") ? uid.split("@")[0] : uid;

      const allowedSnap = await getDoc(doc(db, "allowedUsers", uid));
      if (allowedSnap.exists() && allowedSnap.data().name) {
        setDisplayName(allowedSnap.data().name as string);
      } else {
        setDisplayName(emailFallback);
      }
      setNameLoading(false);
    }

    fetchName();
    getAllPublishedCourses().then((courses) => setCourseCount(courses.length)).catch(() => {});
  }, [firebaseUser, authLoading]);

  if (authLoading || nameLoading) {
    return (
      <div className="min-h-screen bg-texo-azul flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-texo-azul flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/LA_ACADEMIA_NEWSLETTER.png"
          alt="La Academia TEXO"
          style={{ height: "180px", width: "auto", borderRadius: "12px", marginBottom: "1.5rem", display: "block", margin: "0 auto 1.5rem" }}
        />

        {/* Bienvenida */}
        <h1 className="text-3xl font-bold text-white mb-3">
          ¡Bienvenido/a, {displayName.includes("@") ? displayName.split("@")[0] : displayName}!
        </h1>
        <p className="text-white/70 text-base mb-4 leading-relaxed">
          Estás ingresando a la plataforma de autoformación del Grupo TEXO.
        </p>
        {courseCount !== null && courseCount > 0 && (
          <p className="text-texo-amarillo font-semibold text-sm mb-10">
            Tenés {courseCount} propedéutico{courseCount !== 1 ? "s" : ""} disponible{courseCount !== 1 ? "s" : ""}
          </p>
        )}

        <button
          onClick={() => destHref && router.replace(destHref)}
          className="inline-flex items-center gap-2 bg-texo-amarillo text-texo-azul font-bold px-8 py-3 rounded-xl text-base hover:bg-texo-amarillo/90 transition-colors shadow-lg"
        >
          Ingresar →
        </button>

        <p className="text-white/30 text-xs mt-10">
          © {new Date().getFullYear()} Grupo TEXO
        </p>
      </div>
    </div>
  );
}
