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
  courseTitle: string
): Promise<void> {
  const canvas = await captureCanvas();
  if (!canvas) return;

  const { jsPDF } = await import("jspdf");
  const imgData = canvas.toDataURL("image/png");

  // Usar las dimensiones exactas del canvas para que no haya distorsión
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

  const fileName = `certificado-${courseTitle.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  pdf.save(fileName);
}
