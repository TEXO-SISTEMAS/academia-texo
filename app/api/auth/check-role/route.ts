import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return NextResponse.json({ role: "participante" });

    const snap = await getAdminDb().collection("allowedUsers").doc(email).get();
    const role = snap.exists && snap.data()?.role === "artesano" ? "artesano" : "participante";
    return NextResponse.json({ role });
  } catch {
    return NextResponse.json({ role: "participante" });
  }
}
