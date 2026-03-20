import { NextRequest, NextResponse } from "next/server";

// Cache en memoria: cacheKey → array de URLs por página
// Clave: "fileId-totalPages" para invalidar si cambia el número de páginas
const slidesCache = new Map<string, string[]>();

export async function GET(req: NextRequest) {
  const fileId         = req.nextUrl.searchParams.get("fileId");
  const totalPagesParam = req.nextUrl.searchParams.get("totalPages");

  if (!fileId) {
    return NextResponse.json({ error: "fileId requerido" }, { status: 400 });
  }

  const totalPages = totalPagesParam ? parseInt(totalPagesParam) : 0;

  if (!totalPages || totalPages <= 0 || isNaN(totalPages)) {
    console.log("[slides] fileId:", fileId, "totalPages: no definido");
    return NextResponse.json(
      {
        error:
          "El Artesano debe ingresar el número de páginas del PDF al crear el recurso " +
          "para habilitar la navegación página por página.",
      },
      { status: 400 }
    );
  }

  const cacheKey = `${fileId}-${totalPages}`;

  if (slidesCache.has(cacheKey)) {
    const cached = slidesCache.get(cacheKey)!;
    console.log(`[slides] Cache hit — fileId: ${fileId}, ${cached.length} páginas`);
    return NextResponse.json({ slides: cached });
  }

  console.log("[slides] fileId:", fileId, "totalPages:", totalPages);

  // Generar una URL de preview de Drive por página
  const slides: string[] = [];
  for (let i = 1; i <= totalPages; i++) {
    slides.push(`https://drive.google.com/file/d/${fileId}/preview?page=${i}`);
  }

  console.log(`[slides] Generadas ${slides.length} URLs de preview de Drive`);

  slidesCache.set(cacheKey, slides);

  return NextResponse.json({ slides });
}
