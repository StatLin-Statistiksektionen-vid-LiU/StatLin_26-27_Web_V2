// Programmet på STAR-sidan och stjärnkartans placering. Körs utan server: npx tsx --test tests/naringsliv.test.mjs
import assert from "node:assert";
import test from "node:test";
import { addDaysLocal, todayLocal } from "../src/lib/dates.ts";
import { countdownText, isLunchEvent, isStarSlug, mailtoWithSubject, parseProgram, parseSeeks, parseStarFaq, parseStarTips, starIsLive } from "../src/lib/naringsliv.ts";
import { narrowMap, wideMap } from "../src/lib/star-map.ts";

test("programmet läses ur avsnittet och slutar vid nästa rubrik", () => {
  const body = "Intro.\n\n## Program\n- **10.00** Mässan öppnar\n- **12:15** Lunchpanel: Karriär\n**9.05** – Kaffe\nEn vanlig rad\n\n## Hitta hit\n- **17.00** Inte program";
  assert.deepEqual(parseProgram(body), [
    { time: "10.00", text: "Mässan öppnar" },
    { time: "12.15", text: "Lunchpanel: Karriär" },
    { time: "09.05", text: "Kaffe" },
  ]);
});

test("utan avsnitt finns inget program, och CRLF går bra", () => {
  assert.deepEqual(parseProgram("Bara text.\n\n- **10.00** Inte i ett program"), []);
  assert.deepEqual(parseProgram("## Program\r\n- **10.00** Start\r\n"), [{ time: "10.00", text: "Start" }]);
});

test("nedräkningen", () => {
  const today = todayLocal();
  assert.equal(countdownText(`${today}T10:00`), "i dag");
  assert.equal(countdownText(addDaysLocal(`${today}T10:00`, 1)), "i morgon");
  assert.equal(countdownText(addDaysLocal(`${today}T10:00`, 34)), "om 34 dagar");
  assert.equal(countdownText(addDaysLocal(`${today}T10:00`, -1)), null);
});

test("vad som räknas som STAR och lunchföreläsning", () => {
  assert.ok(isStarSlug("star") && isStarSlug("star-2027"));
  assert.ok(!isStarSlug("starta-terminen") && !isStarSlug("star-27"));
  assert.ok(isLunchEvent({ title: "Lunchföreläsning: Regression", slug: "x" }));
  assert.ok(isLunchEvent({ title: "Något", slug: "lunch-med-sasu" }));
  assert.ok(!isLunchEvent({ title: "Pub", slug: "pub" }));
});

test("okända värden i seeks släpps och ordningen är fast", () => {
  assert.deepEqual(parseSeeks("heltid foo exjobb"), ["exjobb", "heltid"]);
  assert.deepEqual(parseSeeks(""), []);
});

test("ämnet i e-postlänken kodas", () => {
  assert.equal(mailtoWithSubject("sasu@statlin.se", "Vi vill hålla"), "mailto:sasu@statlin.se?subject=Vi%20vill%20h%C3%A5lla");
});

const companies = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Företag nummer ${i + 1}` }));

test("kartan är densamma varje gång och oberoende av listans ordning", () => {
  const list = companies(12);
  assert.deepEqual(wideMap(list), wideMap([...list].reverse()));
  assert.deepEqual(narrowMap(list), narrowMap([...list].reverse()));
});

test("ett nytt företag flyttar inga gamla stjärnor", () => {
  const before = wideMap(companies(8));
  const after = wideMap(companies(9));
  // Himlen är lika stor upp till ett visst antal företag, och då ligger de gamla kvar exakt.
  assert.equal(before.height, after.height);
  assert.deepEqual(after.stars.slice(0, 8), before.stars);
});

test("alla stjärnor binds ihop och ligger innanför kartan, också många", () => {
  for (const n of [1, 2, 9, 30, 60]) {
    const map = wideMap(companies(n));
    assert.equal(map.stars.length, n);
    assert.equal(map.lines.length, n - 1);
    for (const s of map.stars) assert.ok(s.x >= 0 && s.x <= map.width && s.y >= 0 && s.y <= map.height);
    // Kartan i avsnittets spalt är smalare och lika mycket högre.
    const smal = wideMap(companies(n), 760);
    assert.equal(smal.width, 760);
    assert.equal(smal.height, Math.round((map.height * 1000) / 760));
    assert.equal(smal.stars.length, n);
    for (const s of smal.stars) assert.ok(s.x >= 0 && s.x <= smal.width && s.y >= 0 && s.y <= smal.height);
  }
  assert.equal(wideMap([]).stars.length, 0);
  assert.equal(narrowMap([]).stars.length, 0);
});

test("STAR-sidan är dold tills inställningen säger ja", () => {
  assert.equal(starIsLive({ star_live: "" }), false);
  assert.equal(starIsLive({ star_live: "0" }), false);
  assert.equal(starIsLive({ star_live: "1" }), true);
});

test("tipsen läses rad för rad, utan tomma rader och egna punkter", () => {
  assert.deepEqual(parseStarTips("Ta med cv:t\r\n\r\n- Läs på om företagen\n  * Kom i tid  \n• Fråga mycket\n"), ["Ta med cv:t", "Läs på om företagen", "Kom i tid", "Fråga mycket"]);
  assert.deepEqual(parseStarTips(""), []);
});

test("frågorna läses som block, och en fråga utan svar visas inte", () => {
  const raw = "Vad kostar det?\nInget alls.\n\nVem får komma?\nAlla.\nÄven alumner.\r\n\r\nFråga utan svar\n\n\n";
  assert.deepEqual(parseStarFaq(raw), [
    { question: "Vad kostar det?", answer: "Inget alls." },
    { question: "Vem får komma?", answer: "Alla. Även alumner." },
  ]);
  assert.deepEqual(parseStarFaq(""), []);
});

test("långa namn kortas på kartan", () => {
  const map = wideMap([{ id: 1, name: "Ett mycket långt företagsnamn som aldrig tar slut AB" }]);
  assert.ok(map.stars[0].label.length <= 30 && map.stars[0].label.endsWith("…"));
});
