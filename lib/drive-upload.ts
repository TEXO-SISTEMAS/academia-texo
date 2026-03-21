export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  directLink: string;
  pdfFileId?: string; // presente si el archivo fue convertido a PDF (DOCX/PPT)
}

export async function uploadVideoDirectToDrive(
  file: File,
  courseTitle: string,
  onProgress?: (pct: number) => void
): Promise<DriveUploadResult> {
  // 1. Iniciar resumable upload — obtiene la uploadUrl de Drive
  const initRes = await fetch("/api/drive/resumable-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName:    file.name,
      mimeType:    file.type || "video/mp4",
      fileSize:    file.size,
      courseTitle: courseTitle,
    }),
  });

  if (!initRes.ok) {
    const data = await initRes.json() as { error?: string };
    throw new Error(data.error ?? "Error al iniciar la subida.");
  }

  const { uploadUrl } = await initRes.json() as { uploadUrl: string };

  // 2. Subir en chunks de 3MB via servidor (evita CORS y el límite de 4.5MB de Vercel)
  //    Google Drive requiere que los chunks intermedios sean múltiplos de 256KB.
  const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB = 256KB × 12
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let fileId: string | undefined;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end   = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const body = new FormData();
    body.append("chunk",     chunk);
    body.append("uploadUrl", uploadUrl);
    body.append("start",     String(start));
    body.append("total",     String(file.size));
    body.append("mimeType",  file.type || "video/mp4");

    const res = await fetch("/api/drive/upload-chunk", { method: "POST", body });

    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? `Error subiendo chunk ${i + 1}/${totalChunks}`);
    }

    const data = await res.json() as { done: boolean; fileId?: string };

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }

    if (data.done) {
      fileId = data.fileId;
      break;
    }
  }

  if (!fileId) throw new Error("Drive no retornó fileId al completar la subida.");

  // 3. Hacer el archivo público
  const pubRes = await fetch("/api/drive/make-public", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
  });

  if (!pubRes.ok) {
    const data = await pubRes.json() as { error?: string };
    throw new Error(data.error ?? "Error al publicar el archivo.");
  }

  return pubRes.json() as Promise<DriveUploadResult>;
}

export async function uploadFileToDrive(
  file: File,
  courseTitle: string,
  onProgress?: (pct: number) => void
): Promise<DriveUploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseTitle", courseTitle);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as DriveUploadResult;
          resolve(data);
        } catch {
          reject(new Error("Respuesta inválida del servidor."));
        }
      } else {
        let message = "Error al subir a Drive.";
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string };
          if (data.error) message = data.error;
        } catch { /* noop */ }
        reject(new Error(message));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Error de red al subir archivo.")));
    xhr.addEventListener("abort", () => reject(new Error("Subida cancelada.")));

    xhr.open("POST", "/api/drive/upload");
    xhr.send(formData);
  });
}
