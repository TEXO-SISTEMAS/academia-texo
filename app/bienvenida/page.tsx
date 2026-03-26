"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getAllPublishedCourses } from "@/lib/firestore";

export default function BienvenidaPage() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string>("");
  const [nameLoading, setNameLoading] = useState(true);
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [destHref, setDestHref] = useState("/participante/dashboard");

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }

    async function fetchName() {
      const uid = firebaseUser!.uid;
      console.log("[BIENVENIDA DEBUG] firebaseUser completo:", JSON.stringify({ uid: firebaseUser!.uid, email: firebaseUser!.email }));

      // uid es el email cuando se usa custom token (ej. "danilo.sosa@texo.com.py")
      const emailFallback = uid.includes("@") ? uid.split("@")[0] : uid;

      // Leer rol y nombre desde allowedUsers
      const allowedSnap = await getDoc(doc(db, "allowedUsers", uid));
      console.log("[BIENVENIDA DEBUG] allowedUsers snap exists:", allowedSnap.exists(), "data:", JSON.stringify(allowedSnap.exists() ? allowedSnap.data() : null));

      if (allowedSnap.exists()) {
        const data = allowedSnap.data();
        if (data.name) setDisplayName(data.name as string);
        else setDisplayName(emailFallback);

        const role = data.role as string | undefined;
        console.log("[BIENVENIDA DEBUG] role:", role);

        let ruta = "/participante/dashboard";
        if (role === "admin") ruta = "/admin";
        else if (role === "artesano") ruta = "/artesano/dashboard";

        console.log("[BIENVENIDA DEBUG] redirecting to:", ruta);
        setDestHref(ruta);
      } else {
        console.log("[BIENVENIDA DEBUG] no allowedUsers doc found for uid:", uid);
        setDisplayName(emailFallback);
        setDestHref("/participante/dashboard");
      }

      setNameLoading(false);
    }

    fetchName();
    getAllPublishedCourses().then((courses) => setCourseCount(courses.length)).catch(() => {});
  }, [firebaseUser, authLoading, router]);

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
          onClick={() => router.replace(destHref)}
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
