/**
 * Extrae el fileId de cualquier formato de URL de Google Drive:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/file/d/FILE_ID/preview
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/uc?export=download&id=FILE_ID
 * - https://drive.google.com/open?id=FILE_ID
 */
export function extractDriveFileId(url: string): string | null {
  // /file/d/{id}/...
  const fileMatch = url.match(/\/file\/d\/([^/?#\s]+)/);
  if (fileMatch) return fileMatch[1];

  // ?id=FILE_ID (uc, open, etc.)
  const idParam = url.match(/[?&]id=([^&\s]+)/);
  if (idParam) return idParam[1];

  return null;
}

/**
 * Convierte cualquier URL de Drive en la URL de preview del reproductor nativo.
 * Para videos: usa el reproductor oficial de Google Drive.
 * Para presentaciones de Google Slides: usa la URL de embed.
 */
export function toDriveEmbedUrl(url: string): string {
  // Google Slides presentation
  const slidesMatch = url.match(/presentation\/d\/([^/?#\s]+)/);
  if (slidesMatch) {
    return `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed?start=false&loop=false`;
  }

  // Cualquier archivo de Drive (video, PDF, etc.)
  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  // URL desconocida — devolver tal cual
  return url;
}
