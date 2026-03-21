/**
 * POST /api/auth/verify
 *
 * Verifica si el email está en la colección 'allowedUsers' y genera un
 * Firebase Custom Token si está autorizado.
 *
 * Documentos de prueba para crear manualmente en Firebase Console:
 *
 * Colección: allowedUsers
 *
 * Documento 1:
 *   ID: danilo.sosa@texo.com.py
 *   email: danilo.sosa@texo.com.py
 *   role: artesano
 *   name: Danilo Sosa
 *
 * Documento 2:
 *   ID: participante@texo.com.py
 *   email: participante@texo.com.py
 *   role: participante
 *   name: Participante Prueba
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    // 1. Parsear body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      console.error("[verify] Error al parsear body JSON");
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const email =
      body && typeof body === "object" && "email" in body
        ? (body as { email: unknown }).email
        : undefined;

    console.log("[verify] body recibido:", { email });

    if (!email || typeof email !== "string" || email.trim() === "") {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Verificar en allowedUsers
    const adminDb = getAdminDb();
    const docSnap = await adminDb
      .collection("allowedUsers")
      .doc(normalizedEmail)
      .get();

    console.log("[verify] allowedUsers doc exists:", docSnap.exists, "| email:", normalizedEmail);

    if (!docSnap.exists) {
      return NextResponse.json({ error: "not_authorized" }, { status: 403 });
    }

    const userData = docSnap.data()!;
    const role: string = userData.role ?? "participante";
    const name: string = userData.name ?? "";

    console.log("[verify] role:", role, "| requiresPassword:", role === "artesano");

    // 3. Artesanos requieren contraseña — no generar token todavía
    if (role === "artesano") {
      console.log("[verify] artesano detectado, requiere contraseña:", normalizedEmail);
      return NextResponse.json({ requiresPassword: true, role, name });
    }

    // 4. Participantes → generar Custom Token directamente
    const adminAuth = getAdminAuth();
    const token = await adminAuth.createCustomToken(normalizedEmail, { role });

    console.log("[verify] token generado para:", normalizedEmail, "| role:", role);

    return NextResponse.json({ token, role, name });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[verify] ERROR:", message);
    if (err instanceof Error && err.stack) console.error(err.stack);
    return NextResponse.json(
      { error: "server_error", detail: message },
      { status: 500 }
    );
  }
}
