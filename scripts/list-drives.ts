import { google } from "googleapis";

const driveServiceAccount = require("../service-account-drive.json");
const driveAuth = new google.auth.GoogleAuth({
  credentials: driveServiceAccount,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth: driveAuth });

async function main() {
  // Listar drives compartidos
  const drivesRes = await drive.drives.list({ pageSize: 20 });
  console.log("Shared Drives:");
  for (const d of drivesRes.data.drives ?? []) {
    console.log(`  ${d.name} → ${d.id}`);
  }

  // Listar archivos en My Drive (para ver qué ocupa espacio)
  const filesRes = await drive.files.list({
    q: "trashed = false",
    fields: "files(id, name, mimeType, size, parents)",
    pageSize: 50,
    orderBy: "quotaBytesUsed desc",
  });
  console.log("\nArchivos en My Drive (sin Shared Drives):");
  for (const f of filesRes.data.files ?? []) {
    const size = Number(f.size ?? 0);
    const mb = (size / 1024 / 1024).toFixed(1);
    console.log(`  [${mb} MB] ${f.name} (${f.mimeType?.split("/").pop()}) → ${f.id}`);
  }

  // Ver quota del service account
  const aboutRes = await drive.about.get({ fields: "storageQuota" });
  const quota = aboutRes.data.storageQuota;
  const usedMb = (Number(quota?.usage ?? 0) / 1024 / 1024).toFixed(1);
  const limitMb = quota?.limit ? (Number(quota.limit) / 1024 / 1024).toFixed(1) : "unlimited";
  console.log(`\nQuota: ${usedMb} MB usados / ${limitMb} MB total`);
}

main().catch(console.error);
