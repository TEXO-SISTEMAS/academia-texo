async function captureCanvas(): Promise<HTMLCanvasElement | null> {
  const html2canvas = (await import("html2canvas")).default;

  // Esperar render completo
  await new Promise((resolve) => setTimeout(resolve, 500));

  const el = document.getElementById("certificate");
  if (!el) return null;

  // Verificar dimensiones
  const rect = el.getBoundingClientRect();
  console.log("[Certificate] Dimensiones:", rect.width, rect.height);
  if (rect.width === 0 || rect.height === 0) {
    console.error("[Certificate] El elemento no tiene dimensiones — abortando captura");
    return null;
  }

  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#1a2a2e",
  });
}

export async function generateCertificatePNGBlob(): Promise<Blob | null> {
  const canvas = await captureCanvas();
  if (!canvas) return null;
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export async function generateCertificatePDF(
  participantName: string,
  courseTitle: string,
  completedAt: Date
): Promise<void> {
  const { pdf } = await import("@react-pdf/renderer");
  const { default: CertificatePDF } = await import(
    "@/components/participante/CertificatePDF"
  );
  const React = (await import("react")).default;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(
    React.createElement(CertificatePDF, { participantName, courseTitle, completedAt }) as any
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `certificado-${courseTitle.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
