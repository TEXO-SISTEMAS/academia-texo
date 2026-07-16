import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

    const adminAuth = getAdminAuth();
    const token = await adminAuth.createCustomToken(email, { role: "participante" });
    return NextResponse.json({ token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: "server_error", detail: message }, { status: 500 });
  }
}
