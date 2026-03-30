"use client";

import Image from "next/image";

interface Props {
  participantName: string;
  courseTitle: string;
  completedAt: Date;
}

export default function Certificate({ participantName, courseTitle, completedAt }: Props) {
  const dateStr = completedAt.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      id="certificate"
      style={{
        width: "1200px",
        height: "850px",
        background: "linear-gradient(135deg, #1a2a2e 0%, #0f1e22 100%)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 64px",
        fontFamily: "Georgia, serif",
        boxSizing: "border-box",
      }}
    >
      {/* Borde exterior dorado */}
      <div style={{
        position: "absolute",
        inset: "12px",
        border: "2px solid #E8B84B",
        borderRadius: "4px",
        pointerEvents: "none",
      }} />
      {/* Borde interior fino */}
      <div style={{
        position: "absolute",
        inset: "18px",
        border: "1px solid rgba(232,184,75,0.35)",
        borderRadius: "2px",
        pointerEvents: "none",
      }} />

      {/* Esquinas decorativas */}
      {[
        { top: 24, left: 24 },
        { top: 24, right: 24 },
        { bottom: 24, left: 24 },
        { bottom: 24, right: 24 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: "absolute",
          width: "24px",
          height: "24px",
          borderColor: "#E8B84B",
          borderStyle: "solid",
          borderWidth: 0,
          borderTopWidth: pos.top !== undefined ? "2px" : 0,
          borderBottomWidth: pos.bottom !== undefined ? "2px" : 0,
          borderLeftWidth: pos.left !== undefined ? "2px" : 0,
          borderRightWidth: pos.right !== undefined ? "2px" : 0,
          ...pos,
        }} />
      ))}

      {/* Logo */}
      <div style={{ marginBottom: "24px" }}>
        <Image
          src="/LA_ACADEMIA_NEWSLETTER.png"
          alt="Academia TEXO"
          width={120}
          height={48}
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Título */}
      <p style={{
        color: "#E8B84B",
        fontSize: "11px",
        letterSpacing: "4px",
        textTransform: "uppercase",
        marginBottom: "16px",
        margin: "0 0 16px",
        fontFamily: "Arial, sans-serif",
      }}>
        Certificado de finalización
      </p>

      {/* Separador */}
      <div style={{
        width: "60px",
        height: "1px",
        background: "linear-gradient(90deg, transparent, #E8B84B, transparent)",
        margin: "0 0 24px",
      }} />

      {/* Texto principal */}
      <p style={{
        color: "rgba(255,255,255,0.65)",
        fontSize: "13px",
        marginBottom: "12px",
        fontFamily: "Arial, sans-serif",
        margin: "0 0 12px",
      }}>
        Se certifica que
      </p>

      {/* Nombre del participante */}
      <p style={{
        color: "#ffffff",
        fontSize: "32px",
        fontWeight: "normal",
        marginBottom: "16px",
        textAlign: "center",
        margin: "0 0 16px",
        letterSpacing: "1px",
      }}>
        {participantName}
      </p>

      {/* Separador */}
      <div style={{
        width: "120px",
        height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(232,184,75,0.5), transparent)",
        margin: "0 0 16px",
      }} />

      <p style={{
        color: "rgba(255,255,255,0.65)",
        fontSize: "13px",
        marginBottom: "12px",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
        margin: "0 0 12px",
      }}>
        ha completado exitosamente el propedéutico
      </p>

      {/* Nombre del curso */}
      <p style={{
        color: "#3A9688",
        fontSize: "22px",
        fontWeight: "normal",
        textAlign: "center",
        marginBottom: "28px",
        margin: "0 0 28px",
        padding: "0 16px",
      }}>
        {courseTitle}
      </p>

      {/* Fecha */}
      <p style={{
        color: "rgba(255,255,255,0.4)",
        fontSize: "12px",
        fontFamily: "Arial, sans-serif",
        margin: 0,
      }}>
        {dateStr}
      </p>

      {/* Footer */}
      <div style={{
        position: "absolute",
        bottom: "32px",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
      }}>
        <p style={{
          color: "rgba(255,255,255,0.2)",
          fontSize: "10px",
          fontFamily: "Arial, sans-serif",
          letterSpacing: "2px",
          textTransform: "uppercase",
          margin: 0,
        }}>
          Grupo TEXO · Academia de Formación Interna
        </p>
      </div>
    </div>
  );
}
