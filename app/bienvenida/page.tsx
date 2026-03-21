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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/LA ACADEMIA_NEWSLETTER.png"
          alt="Academia TEXO"
          style={{ height: "120px", width: "auto", margin: "0 auto 24px" }}
        />

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
