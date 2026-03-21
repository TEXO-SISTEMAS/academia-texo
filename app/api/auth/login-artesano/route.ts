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

    // 2. Verificar contraseña via Firebase Auth REST API
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "server_config_error" }, { status: 500 });
    }

    const firebaseRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    if (!firebaseRes.ok) {
      const errData = await firebaseRes.json().catch(() => ({}));
      const errMessage = (errData as { error?: { message?: string } })?.error?.message ?? "";
      console.log("[login-artesano] Firebase Auth error:", errMessage);
      if (errMessage.includes("INVALID_PASSWORD") || errMessage.includes("EMAIL_NOT_FOUND") || errMessage.includes("INVALID_LOGIN_CREDENTIALS")) {
        return NextResponse.json({ error: "invalid_password" }, { status: 401 });
      }
      return NextResponse.json({ error: "auth_error" }, { status: 500 });
    }

    // 3. Contraseña correcta → generar custom token
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
