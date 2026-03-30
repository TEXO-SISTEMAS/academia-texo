export async function generateCertificatePDF(
  participantName: string,
  courseTitle: string,
  completedAt: Date
): Promise<void> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const el = document.getElementById("certificate");
  if (!el) return;

  const canvas = await html2canvas(el, {
    scale: 3,
    useCORS: true,
    backgroundColor: "#1a2a2e",
  });

  const imgData = canvas.toDataURL("image/png");

  // Tamaño carta landscape en mm
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH);

  const fileName = `certificado-${courseTitle.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  pdf.save(fileName);
}
