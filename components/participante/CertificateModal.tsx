"use client";

import { useState } from "react";
import Certificate from "./Certificate";
import { generateCertificatePDF } from "@/lib/certificate";

interface Props {
  participantName: string;
  courseTitle: string;
  completedAt: Date;
  onClose: () => void;
}

export default function CertificateModal({ participantName, courseTitle, completedAt, onClose }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await generateCertificatePDF(participantName, courseTitle, completedAt);
    } finally {
      setDownloading(false);
    }
  }

  function handleLinkedIn() {
    const text = encodeURIComponent(
      `¡Completé exitosamente el propedéutico "${courseTitle}" en Academia TEXO! #Capacitación #DesarrolloProfesional #GrupoTEXO`
    );
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=https://www.linkedin.com&summary=${text}`, "_blank");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-texo-azul dark:text-white">¡Felicitaciones! 🎓</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Completaste el propedéutico</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Certificado — preview escalado */}
        <div className="p-6 overflow-x-auto">
          <div className="flex justify-center">
            <div style={{ transform: "scale(0.72)", transformOrigin: "top center", marginBottom: "-100px" }}>
              <Certificate
                participantName={participantName}
                courseTitle={courseTitle}
                completedAt={completedAt}
              />
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-semibold transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handleLinkedIn}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#0077B5] text-[#0077B5] hover:bg-[#0077B5]/10 text-sm font-semibold transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Compartir en LinkedIn
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-texo-amarillo text-texo-azul hover:bg-texo-amarillo/90 disabled:opacity-50 text-sm font-semibold transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {downloading ? "Generando PDF..." : "Descargar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
