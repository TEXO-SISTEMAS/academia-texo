"use client";

import { useRouter } from "next/navigation";

interface Props {
  courseTitle: string;
  completedAt: Date;
  onClose: () => void;
}

export default function CreditModal({ courseTitle, completedAt, onClose }: Props) {
  const router = useRouter();

  function handleGoToCredits() {
    onClose();
    router.push("/participante/creditos");
  }

  const dateStr = completedAt.toLocaleDateString("es-PY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header colorido */}
        <div className="bg-gradient-to-br from-texo-azul to-texo-verde px-6 py-8 text-center text-white">
          <div className="text-6xl mb-3">🎟️</div>
          <h2 className="text-2xl font-bold mb-1">¡Crédito obtenido!</h2>
          <p className="text-white/70 text-sm">Completaste un propedéutico TEXO</p>
        </div>

        {/* Info */}
        <div className="px-6 py-6 flex flex-col gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-4 flex flex-col gap-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Propedéutico</p>
            <p className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{courseTitle}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-4 flex flex-col gap-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Fecha de finalización</p>
            <p className="font-semibold text-gray-900 dark:text-white">{dateStr}</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="px-6 pb-6 flex flex-col gap-3">
          <button
            onClick={handleGoToCredits}
            className="w-full bg-texo-amarillo text-texo-azul font-bold py-3 rounded-xl hover:bg-texo-amarillo/90 transition-colors text-sm"
          >
            Ver mis créditos →
          </button>
          <button
            onClick={onClose}
            className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors py-2"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
