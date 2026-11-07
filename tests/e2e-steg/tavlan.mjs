// Uppdragstavlans två vyer: korten på tavlan är länkar till uppdragen, listan sorterar efter vad som är närmast i tiden, och filter
// och vy följer med varandra i adressen. Uppdrag läggs till och flyttas direkt på tavlan, utan sidbyte. På en smal telefon får inget
// sticka ut och tomma statuskolumner ska inte synas.
import assert from "node:assert";
import { uniqueId, waitForHydration } from "../e2e-hjalp.mjs";

const ADMIN = "admin@statlin.se";

const todaySwedish = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());
const addDays = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export default async function tavlanSteg({ BASE, page, step, switchAccount }) {
  const id = uniqueId();
  const today = todaySwedish();
  const overdue = `E2E tavla försenat ${id}`;
  const soon = `E2E tavla snart ${id}`;
  const later = `E2E tavla senare ${id}`;
  const noDate = `E2E tavla utan datum ${id}`;
  const done = `E2E tavla färdig ${id}`;
  const sorted = [overdue, soon, later, noDate, done];

  /** Skickar ett öppet uppdrag från administratören och stannar på uppdragets sida. */
  const newTask = async (title, dueDate) => {
    await page.goto(`${BASE}/admin/uppdrag/ny`);
    const send = page.getByRole("button", { name: "Skicka uppdraget" });
    await waitForHydration(page, send);
    await page.fill('input[name="title"]', title);
    await page.selectOption('select[name="to_user_id"]', "");
    if (dueDate) await page.fill('input[name="due_date"]', dueDate);
    await Promise.all([page.waitForURL(/\/admin\/uppdrag\/\d+\?skapat=1/), send.click()]);
  };

  const taskLink = (text) => page.locator('main a[href^="/admin/uppdrag/"]', { hasText: text }).filter({ visible: true });
  /** Kortet eller raden som uppdraget står på. Den föregående sidan ligger kvar dold, därav bara det synliga. */
  const taskItem = (text) => page.locator("main li", { has: page.locator('a[href^="/admin/uppdrag/"]', { hasText: text }) }).filter({ visible: true });
  /** Uppdragen från det här steget i den ordning de står på sidan. */
  const rows = () => taskItem(id).allInnerTexts();
  const order = (texts) => texts.map((text) => sorted.find((title) => text.includes(title)));

  const filters = () => page.getByRole("navigation", { name: "Vilka uppdrag" });
  const views = () => page.getByRole("navigation", { name: "Visning" });
  /** Väntar in sidan efter ett klick på en länk i ett av valen. Adressen byts innan det nya innehållet har kommit. */
  const waitForActive = (nav, label) => nav.locator('a[aria-current="true"]', { hasText: label }).waitFor();

  await step("Uppdragstavlan: korten är länkar till uppdragen", async () => {
    await switchAccount(page, ADMIN);
    // Skapas i blandad ordning, så att ordningen i listan inte kan komma av hur de skapades.
    await newTask(later, addDays(today, 10));
    await newTask(noDate, null);
    await newTask(overdue, addDays(today, -2));
    await newTask(soon, addDays(today, 1));
    await newTask(done, addDays(today, -3));
    const finish = page.getByRole("button", { name: "Klart", exact: true });
    await waitForHydration(page, finish);
    await finish.click();
    await page.locator('button[aria-pressed="true"]', { hasText: "Klart" }).waitFor();

    await page.goto(`${BASE}/admin/uppdrag`);
    await waitForActive(views(), "Tavla");
    const card = page.getByRole("link", { name: overdue });
    await card.waitFor();
    assert.match(await card.getAttribute("href"), /^\/admin\/uppdrag\/\d+$/);
    assert.match(await card.getAttribute("title"), /Från .+ till vem som helst/);
    const klart = page.getByRole("region", { name: "Klart" }).getByRole("link", { name: done });
    await klart.waitFor();
    await card.click();
    await page.waitForURL(/\/admin\/uppdrag\/\d+$/);
    await page.getByRole("heading", { name: overdue }).waitFor();
  });

  await step("Uppdragstavlan: listan har det försenade först och det klara sist", async () => {
    await page.goto(`${BASE}/admin/uppdrag`);
    await views().getByRole("link", { name: "Lista" }).click();
    await page.waitForURL(/\?vy=lista$/);
    await waitForActive(views(), "Lista");
    await taskLink(overdue).waitFor();
    const texts = await rows();
    assert.deepEqual(order(texts), sorted);
    assert.match(texts[0], /Försenat/);
    assert.doesNotMatch(texts[4], /Försenat/);
    // Statusen är en lista på raden. Texten i en lista tar med alla val, så det är värdet som säger vad som är valt.
    assert.equal(await taskItem(overdue).locator("select").inputValue(), "planerad");
    assert.equal(await taskItem(done).locator("select").inputValue(), "klar");
  });

  await step("Uppdragstavlan: filtret och vyn följer med varandra", async () => {
    await page.goto(`${BASE}/admin/uppdrag?vy=lista`);
    await filters().getByRole("link", { name: "Från dig" }).click();
    await waitForActive(filters(), "Från dig");
    let query = new URL(page.url()).searchParams;
    assert.equal(query.get("visa"), "fran");
    assert.equal(query.get("vy"), "lista");
    await waitForActive(views(), "Lista");
    assert.deepEqual(order(await rows()), sorted);

    const board = views().getByRole("link", { name: "Tavla" });
    assert.equal(await board.getAttribute("href"), "/admin/uppdrag?visa=fran");
    await board.click();
    await waitForActive(views(), "Tavla");
    query = new URL(page.url()).searchParams;
    assert.equal(query.get("visa"), "fran");
    assert.equal(query.get("vy"), null);
    await page.getByRole("link", { name: overdue }).waitFor();

    assert.equal(await filters().getByRole("link", { name: "Alla" }).getAttribute("href"), "/admin/uppdrag");
    await views().getByRole("link", { name: "Lista" }).click();
    await waitForActive(views(), "Lista");
    assert.equal(await filters().getByRole("link", { name: "Alla" }).getAttribute("href"), "/admin/uppdrag?vy=lista");
  });

  const quick = `E2E tavla snabb ${uniqueId()}`;
  const column = (name) => page.getByRole("region", { name });
  const inColumn = (name) => column(name).getByRole("link", { name: quick });
  /** Kortet flyttas innan servern har svarat, så det syns inte på sidan när flytten är sparad. */
  const saving = () => page.waitForResponse((res) => res.request().method() === "POST" && res.url().includes("/admin/uppdrag"));

  await step("Uppdragstavlan: ett uppdrag läggs till på tavlan, utan sidbyte och med fokus kvar i rutan", async () => {
    await page.goto(`${BASE}/admin/uppdrag`);
    const title = page.locator('main input[name="title"]');
    await waitForHydration(page, title);
    const url = page.url();
    await title.fill(quick);
    await title.press("Enter");
    await page.getByText("Uppdraget ligger öppet på tavlan.").waitFor();
    await inColumn("Att göra").waitFor();
    assert.equal(page.url(), url);
    assert.equal(await title.inputValue(), "");
    assert.equal(await title.evaluate((el) => el === document.activeElement), true, "fokus ska stå kvar i rutan");

    // Utan rubrik händer inget på tavlan, men det står varför.
    await title.fill("   ");
    await title.press("Enter");
    await page.getByText("Rubriken måste fyllas i.").waitFor();
    await title.fill("");
  });

  await step("Uppdragstavlan: Jag tar den på kortet flyttar det till Pågår, och det är sparat", async () => {
    const claim = taskItem(quick).getByRole("button", { name: "Jag tar den" });
    await waitForHydration(page, claim);
    await Promise.all([saving(), claim.click()]);
    await inColumn("Pågår").waitFor();
    await page.reload();
    await inColumn("Pågår").waitFor();
    assert.equal(await claim.count(), 0, "ett taget uppdrag är inte öppet längre");
  });

  await step("Uppdragstavlan: ett kort dras till en annan kolumn, och det är sparat", async () => {
    const card = taskItem(quick);
    await waitForHydration(page, card);
    await card.scrollIntoViewIfNeeded();
    const from = await card.boundingBox();
    const to = await column("Klart").boundingBox();
    const y = from.y + from.height / 2;
    await page.mouse.move(from.x + from.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 15, y + 5, { steps: 3 });
    // Kolumnerna är lika höga, så Klart finns i höjd med kortet även när sidan är scrollad.
    await page.mouse.move(to.x + to.width / 2, y, { steps: 8 });
    await Promise.all([saving(), page.mouse.up()]);
    await inColumn("Klart").waitFor();
    await page.reload();
    await inColumn("Klart").waitFor();
  });

  await step("Uppdragstavlan: statuslistan på kortet flyttar det, och hjälp blir en röd markering i Pågår", async () => {
    const menu = taskItem(quick).locator("select");
    await waitForHydration(page, menu);
    await Promise.all([saving(), menu.selectOption("hjalp")]);
    // Markeringen, inte valet med samma text i statuslistan.
    const help = () => taskItem(quick).locator("span", { hasText: /^Behöver hjälp$/ });
    await inColumn("Pågår").waitFor();
    await help().waitFor();
    await page.reload();
    await inColumn("Pågår").waitFor();
    await help().waitFor();
  });

  await step("Uppdragstavlan: går det inte att spara står kortet kvar, och det står varför", async () => {
    const menu = taskItem(quick).locator("select");
    await waitForHydration(page, menu);
    await page.context().setOffline(true);
    try {
      await menu.selectOption("klar");
      await page.getByText("Det gick inte att spara.").waitFor();
    } finally {
      await page.context().setOffline(false);
    }
    await inColumn("Pågår").waitFor();
  });

  await step("Uppdragstavlan: statusen ändras direkt på raden i listan", async () => {
    await page.goto(`${BASE}/admin/uppdrag?vy=lista`);
    const menu = taskItem(quick).locator("select");
    await waitForHydration(page, menu);
    await Promise.all([saving(), menu.selectOption("pagar")]);
    await page.reload();
    await taskLink(quick).waitFor();
    assert.equal(await menu.inputValue(), "pagar");
  });

  await step("Översikten: ett försenat uppdrag till mig står under Att göra nu, och Klart tar bort raden", async () => {
    const late = `E2E tavla sent till mig ${uniqueId()}`;
    await page.goto(`${BASE}/admin/uppdrag`);
    const title = page.locator('main input[name="title"]');
    await waitForHydration(page, title);
    await title.fill(late);
    await page.locator('main input[name="due_date"]').fill(addDays(today, -5));
    await title.press("Enter");
    await page.getByText("Uppdraget ligger öppet på tavlan.").waitFor();
    await Promise.all([saving(), taskItem(late).getByRole("button", { name: "Jag tar den" }).click()]);

    await page.goto(`${BASE}/admin`);
    const row = page.getByRole("region", { name: "Att göra nu" }).getByRole("listitem").filter({ hasText: late });
    await row.getByText("Försenat ·").waitFor();
    const finish = row.getByRole("button", { name: /^Klart/ });
    await waitForHydration(page, finish);
    await finish.click();
    await row.waitFor({ state: "detached" });
    await page.goto(`${BASE}/admin/uppdrag`);
    await column("Klart").getByRole("link", { name: late }).waitFor();
  });

  await step("Uppdragstavlan: inget sticker ut på en smal telefon, och tomma kolumner syns inte", async () => {
    const size = page.viewportSize();
    await page.setViewportSize({ width: 320, height: 640 });
    try {
      for (const path of ["/admin/uppdrag", "/admin/uppdrag?vy=lista"]) {
        await page.goto(`${BASE}${path}`);
        await taskLink(overdue).waitFor();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, `${path} sticker ut ${overflow} px`);
        assert.equal(await page.getByText("Inget här").filter({ visible: true }).count(), 0, path);
      }
    } finally {
      await page.setViewportSize(size);
    }
  });
}
