"use client";

interface Props {
  participantName: string;
  courseTitle: string;
  completedAt: Date;
}

// Posiciones verticales fijas — sin márgenes ni flujo de bloque
const TOP = {
  academia:    130,
  texo:        162,
  etiqueta:    208,
  separador:   240,
  certifica:   270,
  nombre:      308,
  linea:       390,
  completado:  420,
  curso:       458,
  fecha:       530,
  footer:      796,
};

export default function Certificate({ participantName, courseTitle, completedAt }: Props) {
  const dateStr = completedAt.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const center: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  };

  return (
    <div
      id="certificate"
      style={{
        width: "1200px",
        height: "850px",
        backgroundColor: "#1a2a2e",
        position: "relative",
        fontFamily: "Georgia, serif",
      }}
    >
      {/* Bordes decorativos */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, bottom: 16, border: "3px solid #E8B84B" }} />
      <div style={{ position: "absolute", top: 26, left: 26, right: 26, bottom: 26, border: "1px solid #7a5f25" }} />

      {/* ACADEMIA */}
      <div style={{ ...center, top: TOP.academia, color: "#E8B84B", fontSize: "20px", letterSpacing: "7px", fontFamily: "Arial, sans-serif", fontWeight: "bold" }}>
        ACADEMIA
      </div>

      {/* GRUPO TEXO */}
      <div style={{ ...center, top: TOP.texo, color: "#3A9688", fontSize: "12px", letterSpacing: "8px", fontFamily: "Arial, sans-serif" }}>
        GRUPO TEXO
      </div>

      {/* Certificado de Finalización */}
      <div style={{ ...center, top: TOP.etiqueta, color: "#E8B84B", fontSize: "12px", letterSpacing: "5px", textTransform: "uppercase" as const, fontFamily: "Arial, sans-serif" }}>
        Certificado de Finalización
      </div>

      {/* Separador */}
      <div style={{ position: "absolute", top: TOP.separador, left: "50%", marginLeft: "-40px", width: "80px", height: "2px", backgroundColor: "#E8B84B" }} />

      {/* Se certifica que */}
      <div style={{ ...center, top: TOP.certifica, color: "#98adb1", fontSize: "16px", fontFamily: "Arial, sans-serif" }}>
        Se certifica que
      </div>

      {/* Nombre del participante */}
      <div style={{ ...center, top: TOP.nombre, color: "#ffffff", fontSize: "48px", letterSpacing: "1px", lineHeight: "1" }}>
        {participantName}
      </div>

      {/* Línea bajo el nombre */}
      <div style={{ position: "absolute", top: TOP.linea, left: "50%", marginLeft: "-100px", width: "200px", height: "1px", backgroundColor: "#7a5f25" }} />

      {/* ha completado... */}
      <div style={{ ...center, top: TOP.completado, color: "#98adb1", fontSize: "16px", fontFamily: "Arial, sans-serif" }}>
        ha completado exitosamente el propedéutico
      </div>

      {/* Nombre del curso */}
      <div style={{ ...center, top: TOP.curso, color: "#3A9688", fontSize: "30px", lineHeight: "1.2", paddingLeft: "120px", paddingRight: "120px" }}>
        {courseTitle}
      </div>

      {/* Fecha */}
      <div style={{ ...center, top: TOP.fecha, color: "#527178", fontSize: "14px", fontFamily: "Arial, sans-serif" }}>
        {dateStr}
      </div>

      {/* Footer */}
      <div style={{ ...center, top: TOP.footer, color: "#2e4449", fontSize: "11px", fontFamily: "Arial, sans-serif", letterSpacing: "3px", textTransform: "uppercase" as const }}>
        Grupo TEXO · Academia de Formación Interna
      </div>
    </div>
  );
}
