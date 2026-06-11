import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, { role: "artesano" });
    if (!auth.ok) return auth.response;

    const formData = await req.formData();
    const chunk     = formData.get("chunk")     as File   | null;
    const uploadUrl = formData.get("uploadUrl") as string | null;
    const start     = parseInt((formData.get("start")   as string) ?? "0");
    const total     = parseInt((formData.get("total")   as string) ?? "0");
    const mimeType  = (formData.get("mimeType") as string) || "video/mp4";

    if (!chunk || !uploadUrl || isNaN(start) || isNaN(total)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const buffer = Buffer.from(await chunk.arrayBuffer());
    const end    = start + buffer.length - 1;

    console.log(`[upload-chunk] bytes ${start}-${end}/${total} (${buffer.length} bytes)`);

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type":   mimeType,
        "Content-Range":  `bytes ${start}-${end}/${total}`,
        "Content-Length": String(buffer.length),
      },
      body: buffer,
      // No seguir redirects para ver el 308
      redirect: "manual",
    });

    console.log(`[upload-chunk] Drive respondió: ${putRes.status}`);

    // 308 Resume Incomplete — chunk recibido, faltan más
    if (putRes.status === 308) {
      return NextResponse.json({ done: false });
    }

    // 200 / 201 — upload completo
    if (putRes.status === 200 || putRes.status === 201) {
      const data = await putRes.json() as { id?: string };
      console.log("[upload-chunk] Upload completo. fileId:", data.id);
      return NextResponse.json({ done: true, fileId: data.id });
    }

    const errText = await putRes.text();
    throw new Error(`Drive chunk upload falló (${putRes.status}): ${errText}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload-chunk] ERROR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
