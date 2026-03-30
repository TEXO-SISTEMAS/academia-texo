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
        // padding-top calculado para centrar el bloque de contenido (~390px alto)
        paddingTop: "120px",
        paddingLeft: "120px",
        paddingRight: "120px",
        paddingBottom: "80px",
        textAlign: "center",
      }}
    >
      {/* Bordes decorativos */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, bottom: 16, border: "3px solid #E8B84B" }} />
      <div style={{ position: "absolute", top: 26, left: 26, right: 26, bottom: 26, border: "1px solid #7a5f25" }} />

      {/* Logo */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ color: "#E8B84B", fontSize: "20px", letterSpacing: "7px", textTransform: "uppercase", fontFamily: "Arial, sans-serif", fontWeight: "bold", lineHeight: "1.4" }}>
          ACADEMIA
        </div>
        <div style={{ color: "#3A9688", fontSize: "12px", letterSpacing: "8px", textTransform: "uppercase", fontFamily: "Arial, sans-serif", lineHeight: "1.4" }}>
          GRUPO TEXO
        </div>
      </div>

      {/* Etiqueta */}
      <div style={{ color: "#E8B84B", fontSize: "12px", letterSpacing: "5px", textTransform: "uppercase", fontFamily: "Arial, sans-serif", lineHeight: "1.4", marginBottom: "16px" }}>
        Certificado de Finalización
      </div>

      {/* Separador */}
      <div style={{ width: "80px", height: "2px", backgroundColor: "#E8B84B", margin: "0 auto 24px auto" }} />

      {/* "Se certifica que" */}
      <div style={{ color: "#98adb1", fontSize: "16px", fontFamily: "Arial, sans-serif", lineHeight: "1.5", marginBottom: "14px" }}>
        Se certifica que
      </div>

      {/* Nombre del participante */}
      <div style={{ color: "#ffffff", fontSize: "48px", lineHeight: "1.2", marginBottom: "16px", letterSpacing: "1px" }}>
        {participantName}
      </div>

      {/* Línea bajo el nombre */}
      <div style={{ width: "200px", height: "1px", backgroundColor: "#7a5f25", margin: "0 auto 16px auto" }} />

      {/* "ha completado..." */}
      <div style={{ color: "#98adb1", fontSize: "16px", fontFamily: "Arial, sans-serif", lineHeight: "1.5", marginBottom: "14px" }}>
        ha completado exitosamente el propedéutico
      </div>

      {/* Nombre del curso */}
      <div style={{ color: "#3A9688", fontSize: "30px", lineHeight: "1.3", marginBottom: "28px" }}>
        {courseTitle}
      </div>

      {/* Fecha */}
      <div style={{ color: "#527178", fontSize: "14px", fontFamily: "Arial, sans-serif", lineHeight: "1.5" }}>
        {dateStr}
      </div>

      {/* Footer */}
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
