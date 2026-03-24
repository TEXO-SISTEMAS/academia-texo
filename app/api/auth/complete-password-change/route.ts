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
    const idToken = typeof b.idToken === "string" ? b.idToken : "";

    if (!idToken) {
      return NextResponse.json({ error: "idToken_required" }, { status: 400 });
    }

    // 1. Verificar el idToken con Firebase Admin
    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const email = decodedToken.email?.toLowerCase() ?? "";
    if (!email) {
      return NextResponse.json({ error: "email_missing" }, { status: 400 });
    }

    // 2. Verificar que sea artesano en allowedUsers
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

    // 3. Limpiar forcePasswordChange
    await adminDb.collection("allowedUsers").doc(email).update({
      forcePasswordChange: false,
    });

    // 4. Generar custom token para establecer sesión en el cliente
    const customToken = await adminAuth.createCustomToken(email, { role });

    console.log("[complete-password-change] contraseña cambiada para:", email);
    return NextResponse.json({ token: customToken, role, name });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[complete-password-change] ERROR:", message);
    return NextResponse.json({ error: "server_error", detail: message }, { status: 500 });
  }
}
