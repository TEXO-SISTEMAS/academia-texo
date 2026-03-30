"use client";

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
        backgroundColor: "#1a2a2e",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 80px",
        fontFamily: "Georgia, serif",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Borde exterior dorado */}
      <div style={{
        position: "absolute",
        top: "16px", left: "16px", right: "16px", bottom: "16px",
        border: "3px solid #E8B84B",
        pointerEvents: "none",
      }} />
      {/* Borde interior fino */}
      <div style={{
        position: "absolute",
        top: "24px", left: "24px", right: "24px", bottom: "24px",
        border: "1px solid #8b6e2a",
        pointerEvents: "none",
      }} />

      {/* Logo texto — reemplaza imagen para compatibilidad html2canvas */}
      <div style={{ marginBottom: "28px", textAlign: "center" }}>
        <p style={{
          color: "#E8B84B",
          fontSize: "22px",
          letterSpacing: "6px",
          textTransform: "uppercase",
          fontFamily: "Arial, sans-serif",
          fontWeight: "bold",
          margin: 0,
        }}>
          ACADEMIA
        </p>
        <p style={{
          color: "#3A9688",
          fontSize: "14px",
          letterSpacing: "8px",
          textTransform: "uppercase",
          fontFamily: "Arial, sans-serif",
          margin: "2px 0 0",
        }}>
          GRUPO TEXO
        </p>
      </div>

      {/* Título */}
      <p style={{
        color: "#E8B84B",
        fontSize: "13px",
        letterSpacing: "5px",
        textTransform: "uppercase",
        margin: "0 0 20px",
        fontFamily: "Arial, sans-serif",
      }}>
        Certificado de Finalización
      </p>

      {/* Separador sólido */}
      <div style={{ width: "80px", height: "2px", backgroundColor: "#E8B84B", margin: "0 0 28px" }} />

      {/* Texto */}
      <p style={{
        color: "#aab8bb",
        fontSize: "16px",
        margin: "0 0 16px",
        fontFamily: "Arial, sans-serif",
      }}>
        Se certifica que
      </p>

      {/* Nombre participante */}
      <p style={{
        color: "#ffffff",
        fontSize: "44px",
        fontWeight: "normal",
        margin: "0 0 20px",
        textAlign: "center",
        letterSpacing: "1px",
      }}>
        {participantName}
      </p>

      {/* Línea bajo el nombre */}
      <div style={{ width: "160px", height: "1px", backgroundColor: "#8b6e2a", margin: "0 0 20px" }} />

      <p style={{
        color: "#aab8bb",
        fontSize: "16px",
        margin: "0 0 16px",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
      }}>
        ha completado exitosamente el propedéutico
      </p>

      {/* Nombre del curso */}
      <p style={{
        color: "#3A9688",
        fontSize: "28px",
        fontWeight: "normal",
        textAlign: "center",
        margin: "0 0 36px",
        padding: "0 20px",
        fontFamily: "Georgia, serif",
      }}>
        {courseTitle}
      </p>

      {/* Fecha */}
      <p style={{
        color: "#6b7e82",
        fontSize: "14px",
        fontFamily: "Arial, sans-serif",
        margin: 0,
      }}>
        {dateStr}
      </p>

      {/* Footer */}
      <p style={{
        position: "absolute",
        bottom: "40px",
        color: "#334a50",
        fontSize: "11px",
        fontFamily: "Arial, sans-serif",
        letterSpacing: "3px",
        textTransform: "uppercase",
        margin: 0,
      }}>
        Grupo TEXO · Academia de Formación Interna
      </p>
    </div>
  );
}
