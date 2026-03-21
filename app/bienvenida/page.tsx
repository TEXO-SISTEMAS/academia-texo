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

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }

    async function fetchName() {
      const uid = firebaseUser!.uid;

      // Intentar leer el nombre completo desde allowedUsers (ej. "Danilo Sosa")
      const allowedSnap = await getDoc(doc(db, "allowedUsers", uid));
      if (allowedSnap.exists() && allowedSnap.data().name) {
        setDisplayName(allowedSnap.data().name as string);
        setNameLoading(false);
        return;
      }

      // Fallback: leer displayName desde users/{uid}
      const userSnap = await getDoc(doc(db, "users", uid));
      const name: string = userSnap.exists()
        ? (userSnap.data().displayName as string) || uid
        : uid;
      setDisplayName(name);
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", marginBottom: "1.5rem" }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="#E8B84B" strokeWidth="2"/>
            <line x1="24" y1="2" x2="24" y2="46" stroke="#E8B84B" strokeWidth="2"/>
            <line x1="2" y1="24" x2="46" y2="24" stroke="#E8B84B" strokeWidth="2"/>
            <line x1="8" y1="8" x2="40" y2="40" stroke="#E8B84B" strokeWidth="1.5"/>
            <line x1="40" y1="8" x2="8" y2="40" stroke="#E8B84B" strokeWidth="1.5"/>
          </svg>
          <div>
            <div style={{ color: "white", fontSize: "22px", fontWeight: "800", letterSpacing: "0.06em", lineHeight: 1 }}>ACADEMIA</div>
            <div style={{ color: "#E8B84B", fontSize: "14px", fontWeight: "600", letterSpacing: "0.15em" }}>TEXO</div>
          </div>
        </div>

        {/* Bienvenida */}
        <h1 className="text-3xl font-bold text-white mb-3">
          ¡Bienvenido/a, {displayName}!
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
          onClick={() => router.replace("/participante/dashboard")}
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
