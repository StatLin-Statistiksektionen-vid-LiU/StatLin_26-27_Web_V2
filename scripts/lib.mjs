/**
 * Det som create-admin och create-accounts delar. Ren JavaScript: skripten körs med node utanför
 * Nexts bygge, också i Docker-imagen, och når inte modulerna under src/.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Schemat som skripten är skrivna för: user_version efter stegen i src/lib/db/migrations.ts. Talet står
 * medvetet också här, eftersom skripten inte kan importera TypeScript – höj det när ett steg läggs till där.
 */
const EXPECTED_USER_VERSION = 20;

/** Samma ordlista som src/lib/auth/password.ts. Den ligger här eftersom Docker-imagen har scripts/ men inte src/. */
const WORDS = JSON.parse(fs.readFileSync(new URL("./password-words.json", import.meta.url), "utf8"));

/** Läsbart engångslösenord, fyra ord och ett tal – samma format som generatePassword() i src/lib/auth/password.ts. */
export function generatePassword() {
  const pick = () => WORDS[crypto.randomInt(WORDS.length)];
  return `${pick()}-${pick()}-${pick()}-${pick()}-${crypto.randomInt(1000, 9999)}`;
}

/**
 * Öppnar sajtens databas i DATA_DIR (standard ./data). Avslutar om den inte finns eller om schemat inte är
 * det skripten är skrivna för – ett skript från en äldre eller nyare checkout skriver annars mot fel tabeller.
 */
export function openDb() {
  const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
  const dbPath = path.join(dataDir, "statlin.db");
  if (!fs.existsSync(dbPath)) {
    console.error(`Hittar ingen databas i ${dbPath}. Starta webbplatsen en gång (eller kör npm run seed) först.`);
    process.exit(1);
  }
  const db = new Database(dbPath);
  const version = db.pragma("user_version", { simple: true });
  if (version !== EXPECTED_USER_VERSION) {
    db.close();
    console.error(
      `Databasen i ${dbPath} har user_version ${version}, men skripten är skrivna för ${EXPECTED_USER_VERSION}. ` +
        (version < EXPECTED_USER_VERSION
          ? "Starta webbplatsen en gång så att databasen uppdateras, och kör skriptet igen."
          : "Databasen är nyare än skripten: kör skripten från samma version av koden som sajten. Är de redan det har " +
            "EXPECTED_USER_VERSION i scripts/lib.mjs inte höjts med det senaste migreringssteget i src/lib/db/migrations.ts."),
    );
    process.exit(1);
  }
  return db;
}

/**
 * Kör fn i en transaktion som tar skrivlåset direkt (BEGIN IMMEDIATE): allt eller inget. Håller sajten databasen
 * låst längre än better-sqlite3:s busy-timeout (5 s) avslutar skriptet med ett besked i stället för en stackspårning.
 */
export function inTransaction(db, fn) {
  try {
    return db.transaction(fn).immediate();
  } catch (err) {
    if (err?.code !== "SQLITE_BUSY" && err?.code !== "SQLITE_BUSY_SNAPSHOT") throw err;
    console.error("\nDatabasen var upptagen (sajten skrev samtidigt) – inget ändrades, försök igen.");
    process.exit(1);
  }
}
