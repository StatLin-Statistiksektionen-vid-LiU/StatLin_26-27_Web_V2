import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { envPasswordProblem } from "../auth/password";
import { SEED_BOARD, SEED_COMMITTEES, SEED_LINKS, SEED_PAGES } from "../seed-content";

/**
 * Skapar första administratören om databasen saknar konton – vid första start (bootstrap nedan) och i
 * npm run seed, som anropar samma funktion. Lösenordet måste bytas vid första inloggningen. En känd platshållare
 * eller ett lösenord som är tomt eller kortare än 10 tecken efter trim vägras med ett fel. Returnerar true om kontot skapades.
 */
export function createFirstAdmin(db: Database.Database, email: string, password: string): boolean {
  if ((db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n > 0) return false;
  const problem = envPasswordProblem("ADMIN_PASSWORD", password);
  if (problem) throw new Error(`[statlin] ${problem} Administratören skapades inte.`);
  const normalized = email.trim().toLowerCase();
  const styrelsen = db.prepare("SELECT id FROM committees WHERE slug = 'styrelsen'").get() as { id: number } | undefined;
  db.prepare(
    "INSERT INTO users (email, name, post, role, committee_id, password_hash, must_change_password) VALUES (?, 'Administratör', 'Webbansvarig', 'admin', ?, ?, 1)",
  ).run(normalized, styrelsen?.id ?? null, bcrypt.hashSync(password.trim(), 11));
  console.log(`[statlin] Skapade administratören ${normalized} (byt lösenord vid första inloggningen).`);
  return true;
}

/** Tabellerna som får grundinnehåll av bootstrap(). */
export type SeededTable = "committees" | "board_members" | "pages" | "documents" | "links";

/**
 * Markerar att tabellen har fått sitt grundinnehåll (`seeded_<tabell>` = "1" i settings), så att bootstrap() aldrig lägger in det
 * igen (SD-17). Sätts när tabellen seedas och när en rad raderas i adminpanelen: en tabell som tömts med flit ska förbli tom.
 */
export function markSeeded(db: Database.Database, table: SeededTable) {
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, '1')").run(`seeded_${table}`);
}

/**
 * Lägger in tabellens grundinnehåll en gång. Har tabellen flaggan händer ingenting, inte ens om den är tom – då har den tömts med
 * flit. Utan flaggan seedas bara en tom tabell (en ny databas); en tabell med rader men utan flagga kommer från en databas från
 * före flaggorna och får bara flaggan.
 */
function seedOnce(db: Database.Database, table: SeededTable, seed: () => void) {
  if (db.prepare("SELECT 1 FROM settings WHERE key = ?").get(`seeded_${table}`)) return;
  if (!db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get()) seed();
  markSeeded(db, table);
}

/**
 * Körs första gången databasen öppnas i en process: lägger in grunddata (utskott, poster, sidtexter, länkar, styrdokumentet) en
 * gång per tabell (seedOnce), och skapar ett administratörskonto från ADMIN_EMAIL/ADMIN_PASSWORD om det inte finns några konton.
 * Gör en ny installation körbar utan manuella steg. Nytt grundinnehåll når därför bara nya databaser – en befintlig databas får det
 * med ett migreringssteg, som steg 9 gör för länken Hjälpmedel.
 */
export function bootstrap(db: Database.Database) {
  db.transaction(() => {
    seedOnce(db, "committees", () => {
      const insertCommittee = db.prepare(
        `INSERT INTO committees (slug, name, short_name, kind, logo_url, accent, email, tagline, description_md, sort_order, wishes_open)
         VALUES (@slug, @name, @short_name, @kind, @logo_url, @accent, @email, @tagline, @description_md, @sort_order, @wishes_open)`,
      );
      // eSTIG:s sida tar emot spelönskemål från början. Migreringssteg 19 gör samma sak i en befintlig databas.
      SEED_COMMITTEES.forEach((c, i) => insertCommittee.run({ ...c, sort_order: i * 10, wishes_open: c.slug === "estig" ? 1 : 0 }));
    });

    seedOnce(db, "board_members", () => {
      const committeeId = (slug: string) => (db.prepare("SELECT id FROM committees WHERE slug = ?").get(slug) as { id: number } | undefined)?.id ?? null;
      const insertBoard = db.prepare("INSERT INTO board_members (post, name, email, bio, committee_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
      SEED_BOARD.forEach((b, i) => insertBoard.run(b.post, "", b.email, b.bio, committeeId(b.committee), i * 10));
    });

    seedOnce(db, "pages", () => {
      const insertPage = db.prepare("INSERT INTO pages (slug, title, lead, body_md) VALUES (@slug, @title, @lead, @body_md)");
      SEED_PAGES.forEach((p) => insertPage.run(p));
    });

    seedOnce(db, "links", () => {
      const insertLink = db.prepare(
        "INSERT INTO links (label, description, url, keywords, category, icon, featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      );
      SEED_LINKS.forEach((l, i) => insertLink.run(l.label, l.description, l.url, l.keywords ?? "", l.category, l.icon ?? "link", l.featured ? 1 : 0, i * 10));
    });

    seedOnce(db, "documents", () => {
      db.prepare("INSERT INTO documents (title, category, description, url, doc_date, sort_order) VALUES (?, 'grafiskt', ?, ?, ?, 0)").run(
        "Grafiskt styrdokument",
        "Logotyper, färgkoder, typsnitt och klädregler för StatLin och utskotten.",
        "/brand/download/grafiskt-styrdokument.pdf",
        "2021-04-26",
      );
    });

    const email = process.env.ADMIN_EMAIL?.trim();
    const password = process.env.ADMIN_PASSWORD;
    if (email && password) createFirstAdmin(db, email, password);
  })();
}
