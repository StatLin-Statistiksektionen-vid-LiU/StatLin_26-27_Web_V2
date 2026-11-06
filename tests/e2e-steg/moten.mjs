// Styrelsemötena: ordföranden lägger in ett möte med mallens dagordning, notisen på översikten leder dit, ett annat konto föreslår en
// punkt och ordföranden tar med den. Steget tar bort mötet efteråt, så att översikten ser ut som förut för stegen som kommer sedan.
import assert from "node:assert";
import { uniqueId, waitForHydration } from "../e2e-hjalp.mjs";

const CHAIR = "admin@statlin.se";
const MEMBER = "scb@statlin.se";

/** Titlarna på dagordningen, i ordning. Den förra sidan kan ligga kvar dold i dokumentet efter ett sidbyte, så bara den synliga räknas. */
const agenda = (p) =>
  p.locator('section[aria-labelledby="dagordning"]:visible ol > li').evaluateAll((els) => els.map((li) => li.querySelector(":scope > span.flex-1 > span:first-child")?.textContent));

export default async function motenSteg({ BASE, page, step, switchAccount }) {
  const marker = uniqueId();
  const place = `Sektionsrummet ${marker}`;
  const point = `Budget ${marker}`;
  let id;

  await step("Möten: ordföranden lägger in ett möte och dagordningen fylls från mallen", async () => {
    await switchAccount(page, CHAIR);
    await page.goto(`${BASE}/admin/moten`);
    // Tre dagar fram, så att mötet är nästa möte även om ett annat redan ligger en vecka bort.
    const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await page.locator('input[name="starts_at"]:visible').fill(`${day}T17:15`);
    await page.locator('input[name="place"]:visible').fill(place);
    const submit = page.getByRole("button", { name: "Lägg in mötet" });
    await waitForHydration(page, submit);
    await submit.click();
    await page.waitForURL(/\/admin\/moten\/\d+\?ny=1/);
    id = page.url().match(/moten\/(\d+)/)[1];
    const titles = await agenda(page);
    assert.equal(titles[0], "Mötets öppnande");
    assert.equal(titles.at(-1), "Mötets avslutande");
    assert.ok(titles.includes("Övriga frågor"));
  });

  await step("Möten: notisen på översikten leder till dagordningen, och ett annat konto föreslår en punkt", async () => {
    await switchAccount(page, MEMBER);
    await page.goto(`${BASE}/admin`);
    const notice = page.locator(`a[href="/admin/moten/${id}"]:visible`).first();
    await notice.waitFor();
    assert.match(await notice.innerText(), new RegExp(place));
    await waitForHydration(page, notice);
    await notice.click();
    await page.waitForURL(new RegExp(`/admin/moten/${id}$`));
    // Ordförande SCB är inte sektionens ordförande: inga knappar för att bestämma.
    assert.equal(await page.getByRole("button", { name: /^Stryk / }).count(), 0);
    await page.locator('input[name="title"]:visible').fill(point);
    const send = page.getByRole("button", { name: "Skicka förslaget" });
    await waitForHydration(page, send);
    await send.click();
    await page.getByText("Tack! Förslaget väntar på ordförandens beslut.").waitFor();
    await page.locator('section[aria-labelledby="forslag"]:visible', { hasText: point }).waitFor();
  });

  await step("Möten: ordföranden tar med förslaget, som hamnar före Övriga frågor med förslagsställarens namn", async () => {
    await switchAccount(page, CHAIR);
    await page.goto(`${BASE}/admin/moten/${id}`);
    const take = page.getByRole("button", { name: `Ta med ${point}` });
    await waitForHydration(page, take);
    await take.click();
    await page.locator('section[aria-labelledby="dagordning"]:visible ol > li', { hasText: point }).waitFor();
    const titles = await agenda(page);
    assert.equal(titles[titles.indexOf(point) + 1], "Övriga frågor");
    assert.match(await page.locator('section[aria-labelledby="dagordning"]:visible ol > li', { hasText: point }).innerText(), /Föreslagen av/);
  });

  await step("Möten: ordföranden tar bort mötet och notisen försvinner", async () => {
    await page.goto(`${BASE}/admin/moten/${id}`);
    const remove = page.getByRole("button", { name: "Ta bort mötet" }).first();
    await waitForHydration(page, remove);
    await remove.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Ta bort mötet" }).click();
    await page.waitForURL(/\/admin\/moten\?raderat=1/);
    await page.goto(`${BASE}/admin`);
    assert.equal(await page.locator(`a[href="/admin/moten/${id}"]`).count(), 0);
  });
}
