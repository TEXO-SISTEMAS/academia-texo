"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SeleccionarRolPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-texo-dark flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        <Image
          src="/LA_ACADEMIA_NEWSLETTER.png"
          alt="Academia TEXO"
          width={80}
          height={80}
          className="rounded-2xl"
        />

        <div className="text-center">
          <h1 className="text-white text-2xl font-bold">Academia TEXO</h1>
          <p className="text-gray-400 text-sm mt-1">¿Cómo querés ingresar hoy?</p>
        </div>

        <div className="flex flex-col gap-4 w-full">
          <button
            onClick={() => router.push("/artesano/dashboard")}
            className="w-full bg-texo-verde hover:bg-texo-verde/90 text-white rounded-2xl px-6 py-6 flex flex-col items-center gap-2 transition-colors"
          >
            <span className="text-3xl">🎨</span>
            <span className="font-bold text-lg">Artesano</span>
            <span className="text-sm text-white/70">Panel de administración</span>
          </button>

          <button
            onClick={() => router.push("/participante/dashboard")}
            className="w-full bg-texo-azul hover:bg-texo-azul/90 text-white rounded-2xl px-6 py-6 flex flex-col items-center gap-2 transition-colors"
          >
            <span className="text-3xl">📚</span>
            <span className="font-bold text-lg">Participante</span>
            <span className="text-sm text-white/70">Ver cursos y mi progreso</span>
          </button>
        </div>
      </div>
    </div>
  );
}
