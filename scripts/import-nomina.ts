/**
 * import-nomina.ts
 *
 * Importa empleados desde NOMINA PARA CORREOS.xlsx como participantes en allowedUsers.
 * Solo importa los que tienen correo válido (distinto de "No posee").
 * No sobreescribe documentos que ya existan.
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/import-nomina.ts
 */

import * as admin from "firebase-admin";
import * as xlsx from "xlsx";
import * as path from "path";

const serviceAccount = require("../service-account-firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

interface Row {
  Empresa: string;
  "Tipo de Empresa": string;
  "Doc. de Identidad": number;
  "Razon Social": string;
  Cargo: string;
  Departamento: string;
  CORREO: string;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(",")
    .map((part) =>
      part
        .trim()
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    )
    .reverse()
    .join(" ");
}

async function main() {
  const filePath = path.resolve(__dirname, "../NOMINA PARA CORREOS.xlsx");
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Row[] = xlsx.utils.sheet_to_json(sheet);

  const valid = rows.filter(
    (r) => r.CORREO && r.CORREO.trim().toLowerCase() !== "no posee"
  );

  console.log(`Total filas: ${rows.length}`);
  console.log(`Con correo válido: ${valid.length}`);
  console.log(`Sin correo (se saltean): ${rows.length - valid.length}`);
  console.log("");

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of valid) {
    const email = row.CORREO.trim().toLowerCase();
    const name = toTitleCase(row["Razon Social"]);

    try {
      const ref = db.collection("allowedUsers").doc(email);
      const snap = await ref.get();

      if (snap.exists) {
        console.log(`  SKIP (ya existe): ${email}`);
        skipped++;
        continue;
      }

      await ref.set({
        email,
        name,
        role: "participante",
        empresa: row.Empresa ?? "",
        cargo: row.Cargo ?? "",
        departamento: row.Departamento ?? "",
      });

      console.log(`  OK: ${email} — ${name}`);
      created++;
    } catch (err) {
      console.error(`  ERROR: ${email} — ${err}`);
      errors++;
    }
  }

  console.log("");
  console.log(`=== Resultado ===`);
  console.log(`Creados:  ${created}`);
  console.log(`Saltados: ${skipped}`);
  console.log(`Errores:  ${errors}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
