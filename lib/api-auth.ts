import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export type AuthSuccess = { ok: true; uid: string; email: string; role: string };
export type AuthFailure = { ok: false; response: NextResponse };

/**
 * Verifica un Firebase ID Token desde `Authorization: Bearer <token>`
 * y opcionalmente exige un rol (chequeado contra allowedUsers).
 *
 * Uso:
 *   const auth = await requireAuth(req, { role: "artesano" });
 *   if (!auth.ok) return auth.response;
 *   // usar auth.uid / auth.email / auth.role
 */
export async function requireAuth(
  req: NextRequest,
  opts?: { role?: "artesano" | "participante" }
): Promise<AuthSuccess | AuthFailure> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      response: NextResponse.json({ error: "missing_token" }, { status: 401 }),
    };
  }
  const idToken = match[1];

  let decoded: { uid: string; email?: string };
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid_token" }, { status: 401 }),
    };
  }

  const email = (decoded.email ?? "").toLowerCase();

  // El sub del custom token usado en esta app es el email (ver login flow),
  // así que buscamos en allowedUsers por email o por uid como fallback.
  const adminDb = getAdminDb();
  const key = email || decoded.uid;
  const snap = await adminDb.collection("allowedUsers").doc(key).get();
  if (!snap.exists) {
    return {
      ok: false,
      response: NextResponse.json({ error: "not_authorized" }, { status: 403 }),
    };
  }
  const role = (snap.data()?.role as string) ?? "participante";

  if (opts?.role && role !== opts.role) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden_role" }, { status: 403 }),
    };
  }

  return { ok: true, uid: decoded.uid, email, role };
}
