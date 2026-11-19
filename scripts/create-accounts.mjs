#!/usr/bin/env node
/**
 * Skapar ett konto per post i styrelsen (13 st). Ordförande, vice och info är administratörer,
 * resten har utskottsroll – kopplade till sitt utskott, eller till styrelsen för poster utan
 * utskott. Kontona hör till posten och lämnas över varje år.
 *
 * Skriptet kan köras igen: befintliga konton lämnas orörda, förutom att en tom post (eller den
 * gamla platshållaren "Styrelsen") fylls i, att info@ uppgraderas från redaktör till admin och att
 * grafiskt@ får grafiskt ansvar (bilder och omslag på hela sajten).
 * Ren JavaScript så att det går att köra både lokalt och i Docker-containern.
 *
 *   npm run create-accounts
 *   fly ssh console -u statlin -C "node scripts/create-accounts.mjs"
 *
 * Varje nytt konto får ett tillfälligt lösenord som visas en gång och måste bytas vid första
 * inloggningen. Glömda lösenord återställer en administratör under Konton i adminpanelen.
 */
import bcrypt from "bcryptjs";
import { generatePassword, inTransaction, openDb } from "./lib.mjs";

/** E-post, namn, post, roll och utskottets slug. Posten är det som visas på uppdragstavlan. */
const ACCOUNTS = [
  ["ordforande@statlin.se", "Ordförande", "Ordförande", "admin", "styrelsen"],
  ["vice@statlin.se", "Vice ordförande", "Vice ordförande / sekreterare", "admin", "styrelsen"],
  ["info@statlin.se", "Info", "Informationsansvarig", "admin", "styrelsen"],
  ["kassor@statlin.se", "Kassör", "Kassör", "committee", "styrelsen"],
  ["grafiskt@statlin.se", "Grafiskt ansvarig", "Grafiskt ansvarig", "committee", "styrelsen"],
  ["master@statlin.se", "Masteransvarig", "Masteransvarig", "committee", "styrelsen"],
  ["ubu@statlin.se", "UBU", "Utbildningsbevakare", "committee", "ubu"],
  ["sasu@statlin.se", "SASU", "SASU", "committee", "sasu"],
  // Mästerichefen loggar in med mästeriets egen adress, inte en @statlin.se.
  ["shaf@scbmasteri.com", "SCB", "Mästerichef", "committee", "scb"],
  ["statpub@statlin.se", "StatPub", "Pub", "committee", "statpub"],
  ["stig@statlin.se", "STIG", "STIG", "committee", "stig"],
  ["estig@statlin.se", "eSTIG", "e-STIG", "committee", "estig"],
  ["amo@statlin.se", "AMO", "Arbetsmiljöombud", "committee", "amo"],
];

/** Info är webbansvarig och ska vara administratör. */
const UPGRADE_TO_ADMIN = new Set(["info@statlin.se"]);
/** Grafiskt ansvarig byter omslag, galleribilder och loggor överallt och lägger upp mallar. */
const DESIGN = new Set(["grafiskt@statlin.se"]);
/** Posten som skriptet tidigare satte på ordförande och vice – byts mot den riktiga posten. */
const PLACEHOLDER_POSTS = new Set(["", "Styrelsen"]);

// openDb() vägrar ett annat schema än skriptets, så kolumnen design (migrering 7) finns alltid.
const db = openDb();
const findUser = db.prepare("SELECT id, role, post, design FROM users WHERE email = ?");
const setPost = db.prepare("UPDATE users SET post = ? WHERE id = ?");
const setRole = db.prepare("UPDATE users SET role = ? WHERE id = ?");
const setDesign = db.prepare("UPDATE users SET design = 1 WHERE id = ?");
const findCommittee = db.prepare("SELECT id FROM committees WHERE slug = ?");
const insert = db.prepare(
  "INSERT INTO users (email, name, post, role, committee_id, password_hash, must_change_password) VALUES (?, ?, ?, ?, ?, ?, 1)",
);

const created = [];
const skipped = [];
const updated = [];
inTransaction(db, () => {
  for (const [email, name, post, role, committee] of ACCOUNTS) {
    const existing = findUser.get(email);
    if (existing) {
      const changes = [];
      if (PLACEHOLDER_POSTS.has(existing.post) && existing.post !== post) {
        setPost.run(post, existing.id);
        changes.push(`post "${post}"`);
      }
      if (UPGRADE_TO_ADMIN.has(email) && existing.role === "editor") {
        setRole.run("admin", existing.id);
        changes.push("redaktör → admin");
      }
      if (DESIGN.has(email) && !existing.design) {
        setDesign.run(existing.id);
        changes.push("grafiskt ansvar");
      }
      if (changes.length) updated.push(`${email}: ${changes.join(", ")}`);
      else skipped.push(`${email} finns redan (${existing.role}) – orört`);
      continue;
    }
    const committeeRow = findCommittee.get(committee);
    if (!committeeRow) {
      skipped.push(`${email} hoppades över – utskottet "${committee}" finns inte`);
      continue;
    }
    const password = generatePassword();
    const { lastInsertRowid } = insert.run(email, name, post, role, committeeRow.id, bcrypt.hashSync(password, 11));
    if (DESIGN.has(email)) setDesign.run(lastInsertRowid);
    created.push({ email, role, password });
  }
});

if (created.length) {
  console.log(`\n✓ ${created.length} konton skapades. Lösenorden visas bara nu och måste bytas vid första inloggningen:\n`);
  for (const c of created) console.log(`  ${c.role.padEnd(10)} ${c.email.padEnd(24)} ${c.password}`);
} else {
  console.log("\nInga nya konton behövdes.");
}
if (updated.length) console.log(`\nUppdaterade konton:\n${updated.map((s) => `  ${s}`).join("\n")}`);
if (skipped.length) console.log(`\n${skipped.map((s) => `  ${s}`).join("\n")}`);
console.log("\nLogga in på /logga-in.\n");
