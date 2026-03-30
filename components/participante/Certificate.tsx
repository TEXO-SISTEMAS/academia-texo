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
        boxSizing: "border-box",
        overflow: "hidden",
        fontFamily: "Georgia, serif",
      }}
    >
      {/* Bordes decorativos */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, bottom: 16, border: "3px solid #E8B84B", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 26, left: 26, right: 26, bottom: 26, border: "1px solid #7a5f25", pointerEvents: "none" }} />

      {/* Contenido centrado — columna sin position absolute */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 120px",
        boxSizing: "border-box",
        gap: 0,
      }}>

        {/* Logo texto */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ color: "#E8B84B", fontSize: "20px", letterSpacing: "7px", textTransform: "uppercase", fontFamily: "Arial, sans-serif", fontWeight: "bold" }}>
            ACADEMIA
          </div>
          <div style={{ color: "#3A9688", fontSize: "12px", letterSpacing: "8px", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginTop: "4px" }}>
            GRUPO TEXO
          </div>
        </div>

        {/* Etiqueta */}
        <div style={{ color: "#E8B84B", fontSize: "12px", letterSpacing: "5px", textTransform: "uppercase", fontFamily: "Arial, sans-serif", marginBottom: "20px" }}>
          Certificado de Finalización
        </div>

        {/* Separador */}
        <div style={{ width: "80px", height: "2px", backgroundColor: "#E8B84B", marginBottom: "28px" }} />

        {/* "Se certifica que" */}
        <div style={{ color: "#98adb1", fontSize: "16px", fontFamily: "Arial, sans-serif", marginBottom: "18px" }}>
          Se certifica que
        </div>

        {/* Nombre del participante */}
        <div style={{ color: "#ffffff", fontSize: "48px", fontWeight: "normal", textAlign: "center", letterSpacing: "1px", lineHeight: "1.1", marginBottom: "20px" }}>
          {participantName}
        </div>

        {/* Línea */}
        <div style={{ width: "200px", height: "1px", backgroundColor: "#7a5f25", marginBottom: "20px" }} />

        {/* "ha completado..." */}
        <div style={{ color: "#98adb1", fontSize: "16px", fontFamily: "Arial, sans-serif", textAlign: "center", marginBottom: "18px" }}>
          ha completado exitosamente el propedéutico
        </div>

        {/* Nombre del curso */}
        <div style={{ color: "#3A9688", fontSize: "30px", fontWeight: "normal", textAlign: "center", lineHeight: "1.3", marginBottom: "36px", maxWidth: "800px" }}>
          {courseTitle}
        </div>

        {/* Fecha */}
        <div style={{ color: "#527178", fontSize: "14px", fontFamily: "Arial, sans-serif" }}>
          {dateStr}
        </div>

      </div>

      {/* Footer absoluto */}
      <div style={{
        position: "absolute",
        bottom: "36px",
        left: 0,
        right: 0,
        textAlign: "center",
        color: "#2e4449",
        fontSize: "11px",
        fontFamily: "Arial, sans-serif",
        letterSpacing: "3px",
        textTransform: "uppercase",
      }}>
        Grupo TEXO · Academia de Formación Interna
      </div>
    </div>
  );
}
