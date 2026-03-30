import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { PassThrough } from "stream";
import { getAdminDb } from "@/lib/firebase-admin";
import type admin from "firebase-admin";

// ─── Drive auth (mismo patrón que /api/drive/upload) ────────────────────────

const SHARED_DRIVE_ID = "0AOIl1AbCEbVfUk9PVA";

function getDriveAuth() {
  const raw = process.env.DRIVE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("DRIVE_SERVICE_ACCOUNT_JSON no configurado.");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

// ─── Serialización de Timestamps ────────────────────────────────────────────

type PlainData = Record<string, unknown>;

function serializeDoc(data: admin.firestore.DocumentData): PlainData {
  const result: PlainData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "toDate" in value) {
      result[key] = (value as admin.firestore.Timestamp).toDate().toISOString();
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = serializeDoc(value as admin.firestore.DocumentData);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Exportación recursiva de colección ─────────────────────────────────────

type CollectionExport = Record<string, PlainData & { _subcollections?: Record<string, CollectionExport> }>;

async function exportCollection(
  colRef: admin.firestore.CollectionReference
): Promise<CollectionExport> {
  const snapshot = await colRef.get();
  const result: CollectionExport = {};

  for (const doc of snapshot.docs) {
    const data = serializeDoc(doc.data());
    result[doc.id] = { ...data };

    const subcollections = await doc.ref.listCollections();
    if (subcollections.length > 0) {
      result[doc.id]._subcollections = {};
      for (const subCol of subcollections) {
        result[doc.id]._subcollections![subCol.id] = await exportCollection(subCol);
      }
    }
  }

  return result;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Verificar que venga de Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backupFolderId = process.env.BACKUP_DRIVE_FOLDER_ID;
  if (!backupFolderId) {
    return NextResponse.json({ error: "BACKUP_DRIVE_FOLDER_ID no configurado." }, { status: 500 });
  }

  try {
    const db = getAdminDb();
    const now = new Date();

    // Colecciones a exportar
    const rootCollections = ["users", "allowedUsers", "courses", "progress", "auditLog", "loginHistory"];
    const data: Record<string, CollectionExport> = {};
    const summary: Record<string, number> = {};

    for (const colName of rootCollections) {
      data[colName] = await exportCollection(db.collection(colName));
      summary[colName] = Object.keys(data[colName]).length;
    }

    const output = {
      _meta: {
        exportedAt: now.toISOString(),
        source: "vercel-cron",
        collections: rootCollections,
        summary,
      },
      data,
    };

    // Subir a Drive
    const jsonBuffer = Buffer.from(JSON.stringify(output, null, 2), "utf-8");
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const fileName = `backup-${dateStr}.json`;

    const auth = getDriveAuth();
    const drive = google.drive({ version: "v3", auth });

    const stream = new PassThrough();
    stream.end(jsonBuffer);

    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [backupFolderId],
      },
      media: {
        mimeType: "application/json",
        body: stream,
      },
      fields: "id,name",
      supportsAllDrives: true,
    });

    const fileId = uploadRes.data.id;
    const sizeKB = Math.round(jsonBuffer.length / 1024);

    console.log(`[cron/backup] OK — ${fileName} (${sizeKB} KB) → Drive fileId: ${fileId}`);

    return NextResponse.json({
      success: true,
      file: fileName,
      fileId,
      sizeKB,
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/backup] ERROR:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
