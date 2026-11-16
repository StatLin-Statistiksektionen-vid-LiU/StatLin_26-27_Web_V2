// Chattens regler: vilka som är med i en plans tråd, hur meddelandena grupperas och vad som blir en länk. Kräver ingen server:
//   npx tsx --test tests/chatt.test.mjs
import assert from "node:assert";
import { test } from "node:test";
import { canUsePlanThread, isPlanParticipant } from "../src/lib/auth/permissions.ts";
import { dayLabel, defaultChannel, firstUnreadId, groupMessages, markDeleted, mergeMessages, planChannelKey, planIdOf, previewTime, splitLinks } from "../src/lib/chatt.ts";

test("en plans tråd har nyckeln plan:<id>, och inget annat är en tråd", () => {
  assert.equal(planChannelKey(12), "plan:12");
  assert.equal(planIdOf("plan:12"), 12);
  for (const key of ["alla", "styrelsen", "utskott:4", "plan:", "plan:-1", "plan:1x", " plan:1", "plan:1234567890123456"]) assert.equal(planIdOf(key), null, key);
});

const scb = { id: 7, role: "committee", committee_id: 4, post: "", committee_name: "SCB" };
const kassoren = { id: 3, role: "committee", committee_id: 1, post: "Kassör", committee_name: "Styrelsen" };
const administrator = { id: 1, role: "admin", committee_id: 1, post: "Ordförande", committee_name: "Styrelsen" };
const plan = (fields = {}) => ({ owner_user_id: 9, responsible: "", collab_all: 0, ...fields });

test("med i planen är den som la in den, den ansvariga posten och de inbjudna", () => {
  assert.ok(!isPlanParticipant(scb, plan(), false), "ett konto utan koppling till planen");
  assert.ok(isPlanParticipant(scb, plan({ owner_user_id: 7 }), false), "kontot som la in planen");
  assert.ok(isPlanParticipant(scb, plan({ responsible: "scb" }), false), "utskottet står som ansvarigt");
  assert.ok(isPlanParticipant(kassoren, plan({ responsible: "Kassör" }), false), "posten står som ansvarig");
  assert.ok(isPlanParticipant(scb, plan(), true), "inbjuden som medarbetare");
});

test("hela StatLin som medarbetare tar med alla konton", () => {
  assert.ok(isPlanParticipant(scb, plan({ collab_all: 1 }), false));
  assert.ok(isPlanParticipant(kassoren, plan({ collab_all: 1 }), false));
});

test("en administratör får läsa alla trådar men är bara med i sina egna planer", () => {
  assert.ok(!isPlanParticipant(administrator, plan(), false), "ingen avisering från andras planer");
  assert.ok(canUsePlanThread(administrator, plan(), false));
  assert.ok(!canUsePlanThread(scb, plan(), false), "andra konton behöver vara med");
  assert.ok(canUsePlanThread(scb, plan(), true));
});

const summary = (key, unread, lastId) => ({ key, name: key, audience: "", unread, last: lastId ? { id: lastId, body: "", created_at: "", deleted: false, author_id: null, author_name: null } : null });

test("utan vald tråd öppnas den med något oläst, annars den där det senast skrevs", () => {
  assert.equal(defaultChannel([summary("plan:1", 0, 9), summary("plan:2", 2, 4)]).key, "plan:2");
  assert.equal(defaultChannel([summary("plan:1", 0, 3), summary("plan:2", 0, 8), summary("plan:3", 0, 5)]).key, "plan:2");
  assert.equal(defaultChannel([summary("plan:1", 0, 0), summary("plan:2", 0, 0)]).key, "plan:1", "tomma trådar: den första");
  assert.equal(defaultChannel([]), undefined, "ett konto utan trådar");
});

const kassor = { id: 21, name: "Elias Berg", post: "Kassör", color: "#c9a227" };
const ordf = { id: 20, name: "Maja Lindqvist", post: "Ordförande", color: "#ff0707" };
const message = (id, created_at, author, fields = {}) => ({ id, body: `Meddelande ${id}`, created_at, deleted: false, author, ...fields });

test("meddelanden i följd från samma konto blir en grupp, och fem minuters tystnad börjar en ny", () => {
  const days = groupMessages([
    message(1, "2026-11-16T09:00:00.000Z", kassor),
    message(2, "2026-11-16T09:04:00.000Z", kassor),
    message(3, "2026-11-16T09:09:00.000Z", kassor),
    message(4, "2026-11-16T09:14:01.000Z", kassor),
    message(5, "2026-11-16T09:14:30.000Z", ordf),
    message(6, "2026-11-16T09:15:00.000Z", kassor),
  ]);
  assert.equal(days.length, 1);
  assert.deepEqual(days[0].groups.map((g) => g.messages.map((m) => m.id)), [[1, 2, 3], [4], [5], [6]], "luckan räknas från föregående meddelande, inte från gruppens första");
  assert.equal(days[0].groups[2].author.name, "Maja Lindqvist");
});

test("dagen bryts vid midnatt i Stockholm, inte i UTC", () => {
  const days = groupMessages([
    message(1, "2026-11-15T22:58:00.000Z", kassor), // 23.58 svensk tid
    message(2, "2026-11-15T23:01:00.000Z", kassor), // 00.01 dagen efter
    message(3, "2026-06-30T21:59:00.000Z", ordf), // 23.59 i sommartid
    message(4, "2026-06-30T22:00:00.000Z", ordf), // 00.00
  ]);
  assert.deepEqual(days.map((d) => d.day), ["2026-11-15", "2026-11-16", "2026-06-30", "2026-07-01"]);
  assert.ok(days.every((d) => d.groups.length === 1), "samma avsändare inom fem minuter delas ändå av dagsskiftet");
});

test("det första olästa meddelandet börjar en egen grupp, också mitt i någons följd", () => {
  const messages = [
    message(1, "2026-11-16T09:00:00.000Z", kassor),
    message(2, "2026-11-16T09:01:00.000Z", kassor),
    message(3, "2026-11-16T09:02:00.000Z", kassor),
  ];
  const groups = groupMessages(messages, 2)[0].groups;
  assert.deepEqual(groups.map((g) => [g.startsUnread, g.messages.map((m) => m.id)]), [[false, [1]], [true, [2, 3]]]);
  assert.ok(groupMessages(messages)[0].groups.every((g) => !g.startsUnread));
});

test("konton som tagits bort har ingen avsändare och grupperas för sig", () => {
  const groups = groupMessages([message(1, "2026-11-16T09:00:00.000Z", null), message(2, "2026-11-16T09:01:00.000Z", null), message(3, "2026-11-16T09:02:00.000Z", kassor)])[0].groups;
  assert.deepEqual(groups.map((g) => [g.author?.id ?? null, g.messages.length]), [[null, 2], [21, 1]]);
});

test("det olästa börjar vid det första meddelandet från någon annan efter läsmärket", () => {
  const messages = [
    message(1, "2026-11-16T09:00:00.000Z", ordf),
    message(2, "2026-11-16T09:01:00.000Z", kassor),
    message(3, "2026-11-16T09:02:00.000Z", ordf, { deleted: true, body: "" }),
    message(4, "2026-11-16T09:03:00.000Z", ordf),
  ];
  assert.equal(firstUnreadId(messages, 0, 21), 1);
  assert.equal(firstUnreadId(messages, 1, 21), 4, "det egna och det borttagna räknas inte");
  assert.equal(firstUnreadId(messages, 1, 20), 2);
  assert.equal(firstUnreadId(messages, 4, 21), null);
  assert.equal(firstUnreadId([], 0, 21), null);
});

test("nya och äldre meddelanden hamnar i id-ordning, och inget står två gånger", () => {
  const shown = [message(3, "2026-11-16T09:00:00.000Z", kassor), message(5, "2026-11-16T09:02:00.000Z", kassor)];
  const merged = mergeMessages(shown, [message(5, "2026-11-16T09:02:00.000Z", kassor), message(4, "2026-11-16T09:01:00.000Z", ordf), message(6, "2026-11-16T09:03:00.000Z", ordf), message(1, "2026-11-15T09:00:00.000Z", ordf)]);
  assert.deepEqual(merged.map((m) => m.id), [1, 3, 4, 5, 6]);
  assert.equal(mergeMessages(shown, [shown[1]]), shown, "inget nytt: samma lista, så att inget ritas om");
  assert.equal(mergeMessages(shown, []), shown);
});

test("ett borttaget meddelande tappar texten men står kvar", () => {
  const shown = [message(1, "2026-11-16T09:00:00.000Z", kassor), message(2, "2026-11-16T09:01:00.000Z", ordf)];
  const after = markDeleted(shown, [2, 99]);
  assert.deepEqual(after.map((m) => [m.id, m.deleted, m.body]), [[1, false, "Meddelande 1"], [2, true, ""]]);
  assert.equal(after[0], shown[0], "det orörda meddelandet är samma objekt");
  assert.equal(markDeleted(after, [2]), after, "redan borttaget: samma lista");
  assert.equal(markDeleted(shown, []), shown);
});

test("dagens rubrik och tiden i kanallistan", () => {
  assert.equal(dayLabel("2026-11-16", "2026-11-16"), "I dag");
  assert.equal(dayLabel("2026-11-15", "2026-11-16"), "I går");
  assert.equal(dayLabel("2025-12-31", "2026-01-01"), "I går", "över årsskiftet");
  assert.equal(dayLabel("2020-03-05", "2026-11-16"), "Torsdag 5 mars 2020");
  assert.equal(previewTime("2026-11-16T13:32:00.000Z", "2026-11-16"), "14:32", "klockslaget i svensk tid");
  assert.equal(previewTime("2026-11-15T23:30:00.000Z", "2026-11-16"), "00:30", "efter midnatt i Stockholm är det i dag");
  assert.equal(previewTime("2026-11-15T12:00:00.000Z", "2026-11-16"), "i går");
  assert.equal(previewTime("2026-11-02T12:00:00.000Z", "2026-11-16"), "2 nov");
});

test("webbadresser blir länkar och resten är text", () => {
  assert.deepEqual(splitLinks("Hej!"), [{ text: "Hej!" }]);
  assert.deepEqual(splitLinks(""), []);
  assert.deepEqual(splitLinks("Utkastet: https://statlin.se/dokument, läs gärna."), [
    { text: "Utkastet: " },
    { text: "https://statlin.se/dokument", href: "https://statlin.se/dokument" },
    { text: ", läs gärna." },
  ]);
  assert.deepEqual(splitLinks("http://a.se/x?y=1&z=2 och https://b.se."), [
    { text: "http://a.se/x?y=1&z=2", href: "http://a.se/x?y=1&z=2" },
    { text: " och " },
    { text: "https://b.se", href: "https://b.se/" },
    { text: "." },
  ]);
});

test("parenteser och radbrytningar runt en adress hör inte till länken", () => {
  assert.deepEqual(splitLinks("(se https://statlin.se/star)"), [{ text: "(se " }, { text: "https://statlin.se/star", href: "https://statlin.se/star" }, { text: ")" }]);
  const wiki = "https://sv.wikipedia.org/wiki/Median_(statistik)";
  assert.deepEqual(splitLinks(`${wiki}!`), [{ text: wiki, href: wiki }, { text: "!" }], "en parentes som hör till adressen står kvar");
  assert.deepEqual(splitLinks("rad ett\nhttps://a.se/b\nrad tre"), [{ text: "rad ett\n" }, { text: "https://a.se/b", href: "https://a.se/b" }, { text: "\nrad tre" }]);
});

test("markup och andra protokoll blir aldrig länkar", () => {
  const script = '<script>alert("x")</script>';
  assert.deepEqual(splitLinks(script), [{ text: script }]);
  assert.deepEqual(splitLinks("javascript:alert(1) och www.statlin.se"), [{ text: "javascript:alert(1) och www.statlin.se" }]);
  assert.deepEqual(splitLinks("https:// och http://"), [{ text: "https:// och http://" }], "en adress utan värd är bara text");
  assert.deepEqual(splitLinks('<a href="https://a.se/b">x</a>'), [{ text: '<a href="' }, { text: "https://a.se/b", href: "https://a.se/b" }, { text: '">x</a>' }]);
});
