import { NextRequest, NextResponse } from "next/server";
import { sendChatAlert } from "@/lib/chat-alert";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body?.email === "string" ? body.email : "desconocido"

    await sendChatAlert("⚠️ Usuario no puede ingresar", {
      Email: email,
      Hora: new Date().toLocaleString("es-PY", { timeZone: "America/Asuncion" }),
      Acción: "El usuario hizo click en 'Notificar soporte'",
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
