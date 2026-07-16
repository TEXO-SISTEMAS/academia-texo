import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    const password = typeof b.password === "string" ? b.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "email_and_password_required" }, { status: 400 });
    }

    // 1. Verificar que sea artesano en allowedUsers
    const adminDb = getAdminDb();
    const docSnap = await adminDb.collection("allowedUsers").doc(email).get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "not_authorized" }, { status: 403 });
    }

    const userData = docSnap.data()!;
    const role: string = userData.role ?? "participante";
    const name: string = userData.name ?? "";

    if (role !== "artesano") {
      return NextResponse.json({ error: "not_artesano" }, { status: 403 });
    }

    // 2. Verificar contraseña contra Firestore
    const storedPassword: string = userData.password ?? "";
    if (!storedPassword || storedPassword !== password) {
      return NextResponse.json({ error: "invalid_password" }, { status: 401 });
    }

    // 3. Generar custom token
    const adminAuth = getAdminAuth();
    const token = await adminAuth.createCustomToken(email, { role });

    console.log("[login-artesano] token generado para:", email);
    return NextResponse.json({ token, role, name });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[login-artesano] ERROR:", message);
    return NextResponse.json({ error: "server_error", detail: message }, { status: 500 });
  }
}
