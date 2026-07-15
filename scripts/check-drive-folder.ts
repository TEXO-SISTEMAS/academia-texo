import { google } from "googleapis";

const driveServiceAccount = require("../service-account-drive.json");
const driveAuth = new google.auth.GoogleAuth({
  credentials: driveServiceAccount,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth: driveAuth });

const FOLDER_ID = "1nDEit6ZNhKXmZ93cjhSIsydOXap95DU2";
const PPTX_FILE_ID = "1F-aijtOb45XLkc_wRgRmG4h3T7qyCGn6";

async function main() {
  // Info de la carpeta raíz
  const folder = await drive.files.get({
    fileId: FOLDER_ID,
    fields: "id, name, driveId, parents, owners",
    supportsAllDrives: true,
  });
  console.log("Carpeta raíz:");
  console.log(JSON.stringify(folder.data, null, 2));

  // Info del PPTX
  const pptx = await drive.files.get({
    fileId: PPTX_FILE_ID,
    fields: "id, name, driveId, parents, owners",
    supportsAllDrives: true,
  });
  console.log("\nArchivo PPTX:");
  console.log(JSON.stringify(pptx.data, null, 2));

  // Intentar listar Shared Drives con más opciones
  try {
    const drives = await drive.drives.list({ pageSize: 20 });
    console.log("\nShared Drives:", JSON.stringify(drives.data, null, 2));
  } catch (e) {
    console.log("\nNo se pueden listar Shared Drives:", e instanceof Error ? e.message : e);
  }
}

main().catch(console.error);
