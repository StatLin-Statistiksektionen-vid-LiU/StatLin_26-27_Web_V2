import type Database from "better-sqlite3";

/**
 * Gallrar revisionsloggen (SD-31): inloggningar och misslyckade inloggningar efter 90 dagar, övriga rader efter 24 månader – det
 * som integritetssidan (/integritet) lovar. Körs vid tre tillfällen: alltid när en process öppnar databasen (getDb), och med
 * onlyIfDue – bara om senaste gallringen är äldre än ett dygn – från getDb() högst en gång i timmen och från audit(), så att en
 * process som kör länge också gallrar. Tidpunkten står i settings (audit_pruned_at). Ett fel loggas men stoppar aldrig sajten.
 * Frågelådans frågor och utskottens önskemål gallras här också, när deras månad ligger mer än 12 månader bak – de bär bara månaden.
 */
export function pruneAuditLog(db: Database.Database, { onlyIfDue = false } = {}) {
  try {
    const recent = "SELECT 1 FROM settings WHERE key = 'audit_pruned_at' AND value > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')";
    if (onlyIfDue && db.prepare(recent).get()) return;
    // Gallrade frågor ska inte ligga kvar som läsbara rester i databasfilen, samma krav som när ägaren raderar dem.
    db.pragma("secure_delete = ON");
    db.transaction(() => {
      db.prepare(
        "DELETE FROM audit_log WHERE action IN ('login', 'login_failed') AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')",
      ).run();
      db.prepare("DELETE FROM audit_log WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-24 months')").run();
      db.prepare("DELETE FROM box_questions WHERE month < strftime('%Y-%m', 'now', '-12 months')").run();
      db.prepare("DELETE FROM committee_wishes WHERE month < strftime('%Y-%m', 'now', '-12 months')").run();
      db.prepare(
        `INSERT INTO settings (key, value) VALUES ('audit_pruned_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run();
    })();
  } catch (err) {
    console.error("[statlin] Gallringen av revisionsloggen misslyckades:", err);
  }
}
