export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  directLink: string;
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
