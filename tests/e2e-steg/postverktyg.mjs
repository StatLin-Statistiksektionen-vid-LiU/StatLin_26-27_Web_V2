// Årshjulet och projektplanerna: förslagen, korten på översikten, tavlan, planer från mall, lärdomarna, borttagna uppdrag och behörigheterna.
// Datumlogiken vid månads- och årsskiften finns i tests/arshjul.test.mjs. Här används riktiga klockan.
import assert from "node:assert";
import { newVisitor, uniqueId, waitForHydration } from "../e2e-hjalp.mjs";

const ADMIN = "admin@statlin.se";
const SCB = "scb@statlin.se";
const FORBIDDEN = "Du har inte behörighet att göra det här.";
const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];

const todaySwedish = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());
const addDays = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export default async function postverktygSteg({ BASE, browser, page, step, switchAccount, openDeleteConfirm }) {
  const id = uniqueId();
  const today = todaySwedish();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1;
  const firstOfTerm = thisMonth <= 6 ? 1 : 7;
  const nextTitle = `E2E nästa månad ${id}`;
  const toPlanTitle = `E2E att planera ${id}`;
  const planTitle = `E2E-plan ${id}`;
  const wheelPlanTitle = `E2E-hjulplan ${id}`;
  const lessons = `Boka tidigare nästa gång ${id}`;

  const wheelCount = async (on = page) => Number((await on.getByRole("status").filter({ hasText: /punkt/ }).first().textContent()).match(/\d+/)[0]);
  const fillButton = (on) => on.getByRole("button", { name: "Fyll med förslag" });
  const row = (title, on = page) => on.getByRole("article").filter({ has: on.getByRole("heading", { name: title }) });
  const openWheel = async (on = page) => {
    await on.goto(`${BASE}/admin/arshjul`);
    await on.getByRole("status").filter({ hasText: /punkt/ }).first().waitFor();
  };

  /** Lägger in en punkt med formuläret och svarar med dess id. */
  const addItem = async ({ title, month, depends = "", responsible = "" }) => {
    await page.goto(`${BASE}/admin/arshjul/ny`);
    await waitForHydration(page, page.getByRole("button", { name: "Lägg till punkten" }));
    await page.fill('input[name="title"]', title);
    await page.fill('input[name="responsible"]', responsible);
    await page.selectOption('select[name="month"]', String(month));
    await page.locator("summary", { hasText: "Fler val" }).click();
    await page.fill('input[name="depends_on"]', depends);
    await page.getByRole("button", { name: "Lägg till punkten" }).click();
    await page.getByText("Punkten ligger i hjulet.").waitFor();
    const href = await page.getByRole("link", { name: `Ändra ${title}` }).getAttribute("href");
    return Number(href.split("/").pop());
  };

  /** Byter id:t i knappens formulär mot någon annans, som den som skickar formuläret för hand. */
  const forgeId = (button, value) => button.evaluate((b, v) => (b.form.querySelector('input[name="id"]').value = v), String(value));

  const planPageId = () => Number(new URL(page.url()).pathname.split("/").pop());

  /** En rad i planens stegslista. */
  const stepRow = (title) => page.locator("article li", { hasText: title });

  /** Fyller i och skapar en plan på sidan som redan är öppen. */
  const submitPlan = async (title, date) => {
    await page.fill('input[name="title"]', title);
    await page.fill('input[name="plan_date"]', date);
    const button = page.getByRole("button", { name: /Skapa planen/ });
    await button.click();
    await page.getByText("Planen är skapad").waitFor();
  };

  await switchAccount(page, ADMIN);

  await step("Årshjul: förslagen läggs in en gång, också när två har sidan öppen", async () => {
    await openWheel();
    // Vid en körning till mot samma databas är hjulet redan fyllt, och knappen visas bara när något förslag saknas.
    if ((await fillButton(page).count()) === 0) {
      // Länken kan ligga under Tidigare i år eller Tidigare i höst, så den hittas utan att behöva synas.
      await page.goto(`${BASE}${await page.locator('a[aria-label="Ändra Budget för året"]').getAttribute("href")}`);
      await (await openDeleteConfirm(page)).getByRole("button", { name: "Ta bort" }).click();
      await page.getByText("Punkten är borttagen.").waitFor();
    }
    const other = await page.context().newPage();
    try {
      await openWheel(other);
      await openWheel();
      await waitForHydration(page, fillButton(page).first());
      await waitForHydration(other, fillButton(other).first());
      await fillButton(page).first().click();
      await page.getByText(/förslag är inlagda\. Allt går att ändra/).waitFor();
      const filled = await wheelCount();
      assert.ok(filled >= 21, `${filled} punkter efter förslagen`);
      assert.equal(await fillButton(page).count(), 0, "knappen ska försvinna när alla förslag finns");
      await fillButton(other).first().click();
      await other.getByText("Alla förslag finns redan i hjulet.").waitFor();
      await openWheel();
      assert.equal(await wheelCount(), filled, "en andra fyllning får inte lägga till något");
      assert.equal(await page.getByRole("heading", { name: "Julsittning", exact: true }).count(), 1);
    } finally {
      await other.close();
    }
  });

  await step("Årshjul: hjulet går att använda med klick, och filtret syns i listan", async () => {
    await openWheel();
    await waitForHydration(page, page.locator('svg a[aria-label^="Mars"]'));
    await page.locator('svg a[aria-label^="Mars"]').click();
    await page.getByText(/punkter? i mars/).waitFor();
    assert.match(page.url(), /manad=3/);
    await page.getByRole("heading", { name: "Sektionsmöte på våren" }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Julsittning", exact: true }).count(), 0);
    await page.getByRole("link", { name: "Visa hela året" }).click();
    await page.waitForURL(/\/admin\/arshjul$/);
    // Skräp i adressen ger hela året i stället för ett fel.
    await page.goto(`${BASE}/admin/arshjul?manad=13&ar=1999`);
    // På hösten visar hjulet hösten och våren efter nyår, och vårens månader får nästa års årtal.
    await page.getByText(new RegExp(`under (hösten )?${thisYear}`)).waitFor();
    if (thisMonth >= 7) await page.getByRole("heading", { name: `Januari ${thisYear + 1}` }).waitFor();
  });

  await step("Översikten: punkterna hamnar på rätt kort", async () => {
    await addItem({ title: nextTitle, month: nextMonth });
    await addItem({ title: toPlanTitle, month: firstOfTerm, depends: "En föreläsare" });
    await page.goto(`${BASE}/admin`);
    const next = page.locator('section[aria-labelledby="kort-nasta-manad"]');
    const plan = page.locator('section[aria-labelledby="kort-att-planera"]');
    await next.getByRole("heading", { name: nextTitle }).waitFor();
    await plan.getByRole("heading", { name: toPlanTitle }).waitFor();
    assert.equal(await plan.getByRole("heading", { name: nextTitle }).count(), 0);
    assert.equal(await next.getByRole("heading", { name: toPlanTitle }).count(), 0);
    if (firstOfTerm < thisMonth) await row(toPlanTitle).getByText("Månaden har passerat").waitFor();
  });

  let boardTask;
  await step("Årshjul: Lägg på tavlan ger ett uppdrag med rimligt datum, och punkten visar att den är planerad", async () => {
    const button = row(nextTitle).getByRole("button", { name: "Lägg på tavlan" });
    await waitForHydration(page, button);
    await button.click();
    await row(nextTitle).getByRole("link", { name: "På tavlan" }).waitFor();
    await row(nextTitle).getByText("Planerad").waitFor();
    assert.equal(await row(nextTitle).getByRole("button", { name: "Lägg på tavlan" }).count(), 0);
    boardTask = await row(nextTitle).getByRole("link", { name: "På tavlan" }).getAttribute("href");
    await page.goto(`${BASE}${boardTask}`);
    await page.getByRole("heading", { name: nextTitle }).waitFor();
    await page.getByText(`1 ${MONTHS[nextMonth - 1]}`).first().waitFor();
  });

  await step("Årshjul: ett borttaget uppdrag gör punkten öppen igen, utan fel", async () => {
    await (await openDeleteConfirm(page)).getByRole("button", { name: "Ta bort" }).click();
    await page.waitForURL(/\/admin\/uppdrag(\?|$)/);
    await page.goto(`${BASE}/admin`);
    await row(nextTitle).getByRole("button", { name: "Lägg på tavlan" }).waitFor();
    assert.equal(await row(nextTitle).getByText("Planerad").count(), 0);
  });

  await step("Årshjul: Klar i år tar bort punkten från kortet, och Ångra tar tillbaka den", async () => {
    const klar = row(toPlanTitle).getByRole("button", { name: "Klar i år" });
    await waitForHydration(page, klar);
    await klar.click();
    await row(toPlanTitle).waitFor({ state: "detached" });
    await page.goto(`${BASE}/admin/arshjul?manad=${firstOfTerm}`);
    await row(toPlanTitle).getByText("Klar i år").waitFor();
    const undo = row(toPlanTitle).getByRole("button", { name: "Ångra" });
    await waitForHydration(page, undo);
    await undo.click();
    await row(toPlanTitle).getByRole("button", { name: "Lägg på tavlan" }).waitFor();
  });

  let plan;
  await step("Projektplan: stegens datum räknas ut från mallen, och passerade steg markeras", async () => {
    await page.goto(`${BASE}/admin/projektplaner/ny`);
    await waitForHydration(page, page.locator('input[name="plan_date"]'));
    await page.getByText("Välj en mall så visas stegen här.").waitFor();
    await page.locator("label", { hasText: "Sittning" }).filter({ hasText: "9 steg" }).click();
    await page.getByText("Välj ett datum så räknas stegen ut.").waitFor();

    // Mallens första steg ligger tio veckor före datumet, och i närtid har det alltså redan passerat.
    await page.fill('input[name="plan_date"]', addDays(today, 7));
    assert.equal(await page.locator('input[name="step_due"]').first().inputValue(), addDays(today, 7 - 70));
    await page.getByText("Har redan passerat").first().waitFor();

    const date = addDays(today, 100);
    await page.fill('input[name="plan_date"]', date);
    const dues = await page.locator('input[name="step_due"]').evaluateAll((els) => els.map((e) => e.value));
    assert.equal(dues.length, 9);
    assert.equal(dues[0], addDays(date, -70));
    assert.ok(dues.includes(date), "dagen själv är ett steg");
    assert.equal(await page.getByText("Har redan passerat").count(), 0);

    // Ta bort ett steg och ändra ett annat innan planen skapas.
    await page.getByRole("button", { name: "Ta bort Beställ affisch och omslag" }).click();
    await page.locator('textarea[name="step_title"]').first().fill(`Boka lokalen ${id}`);
    await page.locator('input[name="step_due"]').first().fill(addDays(date, -77));
    await submitPlan(planTitle, date);
    plan = planPageId();
    await page.getByRole("img", { name: "0 av 8 steg klara" }).waitFor();
    await stepRow(`Boka lokalen ${id}`).waitFor();
    assert.equal(await page.locator("article").getByText("Beställ affisch och omslag").count(), 0);
  });

  await step("Projektplan: stegen stannar i planen tills de skickas till tavlan", async () => {
    const title = `Boka lokalen ${id}`;
    await stepRow(title).getByText("Inte på tavlan än").waitFor();
    assert.equal(await stepRow(title).getByRole("link", { name: title }).count(), 0, "ett oskickat steg har inget uppdrag att länka till");
    await page.goto(`${BASE}/admin/uppdrag`);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    assert.equal(await page.locator("main").getByText(title).count(), 0, "inget ska ligga på tavlan än");

    await page.goto(`${BASE}/admin/projektplaner/${plan}`);
    const send = stepRow(title).getByRole("button", { name: `Skicka ${title} till tavlan` });
    await waitForHydration(page, send);
    await send.click();
    await page.getByText("ligger nu på tavlan.").waitFor();
    await stepRow(title).getByRole("link", { name: title }).waitFor();
    await page.getByRole("button", { name: "Skicka alla 7" }).waitFor();
    // Att ett steg ligger på tavlan betyder inte att det är klart.
    await page.getByRole("img", { name: "0 av 8 steg klara" }).waitFor();

    await stepRow(title).getByRole("link", { name: title }).click();
    await page.waitForURL(/\/admin\/uppdrag\/\d+/);
    await page.getByRole("heading", { name: title }).waitFor();
    await page.getByRole("link", { name: planTitle }).waitFor();
    await page.goto(`${BASE}/admin/uppdrag`);
    await page.locator("main").getByText(title).first().waitFor();
  });

  await step("Projektplan: ett borttaget uppdrag lämnar steget oskickat i planen", async () => {
    const title = `Boka lokalen ${id}`;
    await page.goto(`${BASE}/admin/projektplaner/${plan}`);
    await page.goto(`${BASE}${await stepRow(title).getByRole("link", { name: title }).getAttribute("href")}`);
    await (await openDeleteConfirm(page)).getByRole("button", { name: "Ta bort" }).click();
    await page.waitForURL(/\/admin\/uppdrag(\?|$)/);
    await page.goto(`${BASE}/admin/projektplaner/${plan}`);
    await page.getByRole("img", { name: "0 av 8 steg klara" }).waitFor();
    await stepRow(title).getByRole("button", { name: `Skicka ${title} till tavlan` }).waitFor();
    await stepRow(title).getByText("Inte på tavlan än").waitFor();
  });

  await step("Projektplan: ett steg bockas av, ändras och tas bort utan att hamna på tavlan", async () => {
    const title = "Sätt tema, meny och budget";
    const box = stepRow(title).getByRole("checkbox");
    await waitForHydration(page, box);
    await box.click();
    await page.getByRole("img", { name: "1 av 8 steg klara" }).waitFor();
    await stepRow(title).getByText("Klart utan uppdrag").waitFor();
    await page.getByRole("button", { name: "Skicka alla 7" }).waitFor();
    await box.click();
    await page.getByRole("img", { name: "0 av 8 steg klara" }).waitFor();
    await page.getByRole("button", { name: "Skicka alla 8" }).waitFor();

    // Ändra rubriken på ett steg.
    const renamed = `Handla mat ${id}`;
    await stepRow("Handla och beställ mat").getByRole("button", { name: "Ändra Handla och beställ mat" }).click();
    await stepRow("Handla och beställ mat").locator('input[name="title"]').fill(renamed);
    await stepRow("Handla och beställ mat").getByRole("button", { name: "Spara" }).click();
    await stepRow(renamed).waitFor();
    await stepRow(renamed).locator('input[name="title"]').waitFor({ state: "detached" });

    // Ta bort steget: det är bara planens steg som försvinner.
    await stepRow(renamed).getByRole("button", { name: `Ändra ${renamed}` }).click();
    await stepRow(renamed).getByRole("button", { name: "Ta bort steget" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Ta bort steget" }).click();
    await page.getByText("Steget är borttaget ur planen.").waitFor();
    await page.getByRole("img", { name: "0 av 7 steg klara" }).waitFor();
    assert.equal(await stepRow(renamed).count(), 0);
  });

  await step("Projektplan: ett nytt steg läggs i planen, och Skicka alla skickar resten till rätt mottagare", async () => {
    const added = `Tacka volontärerna ${id}`;
    await page.locator("summary", { hasText: "Lägg till ett steg" }).click();
    const form = page.locator("details", { hasText: "Lägg till ett steg" });
    await form.locator('input[name="title"]').fill(added);
    await form.getByRole("button", { name: "Lägg till steget" }).click();
    await page.getByText("Skicka det till tavlan när det är redo.").waitFor();
    await page.getByRole("img", { name: "0 av 8 steg klara" }).waitFor();
    await stepRow(added).getByText("Inte på tavlan än").waitFor();

    // Öppet: vem som helst kan ta dem.
    await page.locator('article select[name="to"]').selectOption("");
    const sendAll = page.getByRole("button", { name: "Skicka alla 8" });
    await sendAll.click();
    await page.getByText("8 steg ligger nu på tavlan.").waitFor();
    await stepRow(added).getByText("Öppet").waitFor();
    await page.getByRole("link", { name: /8 av 8 på tavlan/ }).waitFor();
    assert.equal(await page.getByRole("button", { name: /^Skicka alla/ }).count(), 0, "inget är kvar att skicka");
    assert.equal(await page.locator("article").getByRole("checkbox").count(), 0, "skickade steg bockas av på tavlan");

    // Klart på tavlan räknas i planen.
    await page.goto(`${BASE}${await stepRow(added).getByRole("link", { name: added }).getAttribute("href")}`);
    await page.getByRole("heading", { name: added }).waitFor();
    const finished = page.getByRole("button", { name: "Klart", exact: true });
    await waitForHydration(page, finished);
    await finished.click();
    await page.locator('button[aria-pressed="true"]', { hasText: "Klart" }).waitFor();
    await page.goto(`${BASE}/admin/projektplaner/${plan}`);
    await page.getByRole("img", { name: "1 av 8 steg klara" }).waitFor();
  });

  await step("Projektplan: från en årshjulspunkt, och lärdomarna visas nästa år", async () => {
    await page.goto(`${BASE}/admin`);
    await row(toPlanTitle).getByRole("link", { name: "Projektplan" }).click();
    await page.waitForURL(/\/admin\/projektplaner\/ny\?punkt=/);
    const newPlanUrl = new URL(page.url());
    const itemId = newPlanUrl.searchParams.get("punkt");
    await waitForHydration(page, page.locator('input[name="plan_date"]'));
    await page.locator("label", { hasText: "Gästföreläsning" }).filter({ hasText: "steg" }).click();
    await submitPlan(wheelPlanTitle, addDays(today, 60));
    const wheelPlan = planPageId();

    await page.locator("summary", { hasText: "Ändra planen" }).click();
    const save = page.getByRole("button", { name: "Spara" });
    await waitForHydration(page, save);
    await page.fill('textarea[name="lessons"]', lessons);
    await page.fill('textarea[name="budget"]', "Budget 5 000 kr");
    await save.click();
    await page.locator("article").getByText(lessons).waitFor();

    // Punkten leder nu till planen, och samma år skapas ingen plan till.
    await page.goto(`${BASE}/admin`);
    assert.equal(await row(toPlanTitle).count(), 0, "en planerad punkt står inte kvar på Att planera in");
    await page.goto(`${BASE}/admin/arshjul?manad=${firstOfTerm}`);
    assert.match(await row(toPlanTitle).getByRole("link", { name: "Till planen" }).getAttribute("href"), new RegExp(`/${wheelPlan}$`));

    await page.goto(`${BASE}/admin/projektplaner/ny?punkt=${itemId}&ar=${thisYear + 1}`);
    await page.getByText("Lärdomar från tidigare år").waitFor();
    await page.getByText(lessons).waitFor();
  });

  await step("Projektplan: utskriften visar dokumentet utan meny och knappar", async () => {
    await page.goto(`${BASE}/admin/projektplaner/${plan}`);
    await page.getByRole("button", { name: "Skriv ut" }).waitFor();
    await page.emulateMedia({ media: "print" });
    try {
      assert.equal(await page.getByRole("button", { name: "Skriv ut" }).isVisible(), false);
      assert.equal(await page.locator("aside").first().isVisible(), false);
      assert.equal(await page.locator("summary", { hasText: "Ändra planen" }).isVisible(), false);
      assert.ok(await page.getByRole("heading", { name: planTitle }).isVisible());
    } finally {
      await page.emulateMedia({ media: "screen" });
    }
  });

  await step("Behörighet: en annan post läser och lägger till, men kan inte ändra", async () => {
    const nextMonthUrl = `${BASE}/admin/arshjul?manad=${nextMonth}`;
    await page.goto(nextMonthUrl);
    const adminItem = Number((await page.getByRole("link", { name: `Ändra ${nextTitle}` }).getAttribute("href")).split("/").pop());
    await page.goto(`${BASE}/admin/projektplaner`);
    await page.getByRole("link", { name: wheelPlanTitle }).click();
    await page.waitForURL(/\/admin\/projektplaner\/\d+$/);
    const adminStepEdit = page.locator("article").getByRole("button", { name: /^Ändra / }).first();
    await waitForHydration(page, adminStepEdit);
    await adminStepEdit.click();
    const adminStep = await page.locator('article li input[name="id"]').first().inputValue();
    await switchAccount(page, SCB);

    // Läser allt, men får bara ändra sitt eget och det där utskottet är ansvarigt.
    await page.goto(nextMonthUrl);
    await row(nextTitle).waitFor();
    assert.equal(await page.getByRole("link", { name: `Ändra ${nextTitle}` }).count(), 0);
    // I december gäller nästa månad nästa år, och då står året på knappen i stället för i år.
    assert.equal(await row(nextTitle).getByRole("button", { name: /^Klar (i år|\d{4})$/ }).count(), 0);
    await page.goto(`${BASE}/admin/arshjul`);
    assert.equal(await page.locator('a[aria-label="Ändra Julsittning"]').count(), 1, "SCB är ansvarigt för julsittningen");
    await page.goto(`${BASE}/admin/arshjul/${adminItem}`);
    await page.waitForURL(/\/admin\/arshjul$/);

    // Sidan stoppar inte den som skickar formuläret ändå: servern ska säga nej när id:t byts mot någon annans.
    const ownTitle = `E2E SCB ${id}`;
    const ownItem = await addItem({ title: ownTitle, month: nextMonth });
    await page.goto(`${BASE}/admin/arshjul/${ownItem}`);
    const save = page.getByRole("button", { name: "Spara" });
    await waitForHydration(page, save);
    await forgeId(save, adminItem);
    await save.click();
    await page.getByText(FORBIDDEN).waitFor();

    await page.goto(nextMonthUrl);
    const klar = row(ownTitle).getByRole("button", { name: /^Klar (i år|\d{4})$/ });
    await waitForHydration(page, klar);
    await forgeId(klar, adminItem);
    await klar.click();
    await page.getByText(FORBIDDEN).first().waitFor();
    await page.goto(nextMonthUrl);
    await row(nextTitle).waitFor();
    assert.equal(await row(nextTitle).getByRole("button", { name: "Lägg på tavlan" }).count(), 1, "punkten får inte ha blivit klar");

    // Bara SCB visar det utskottet är ansvarigt för och det det själv har lagt in, inte andras punkter.
    await page.goto(`${BASE}/admin/arshjul?vara=1`);
    await row(ownTitle).waitFor();
    assert.equal(await row(nextTitle).count(), 0, "filtret ska dölja andras punkter");
    assert.equal(await page.locator('a[aria-label="Ändra Julsittning"]').count(), 1, "julsittningen är SCB:s");

    // Planen: läser, men ser inga ändringsknappar, och servern stoppar den som försöker ändå.
    await page.goto(`${BASE}/admin/projektplaner/${plan}`);
    await page.getByRole("heading", { name: planTitle }).waitFor();
    assert.equal(await page.locator("summary", { hasText: "Ändra planen" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Ta bort" }).count(), 0);
    assert.equal(await page.locator("article").getByRole("button", { name: /^Skicka/ }).count(), 0, "en annan post skickar inte stegen");
    assert.equal(await page.locator("article").getByRole("button", { name: /^Ändra/ }).count(), 0);

    await page.goto(`${BASE}/admin/projektplaner/ny`);
    await waitForHydration(page, page.locator('input[name="plan_date"]'));
    await page.locator("label", { hasText: "Evenemang" }).filter({ hasText: "8 steg" }).click();
    await submitPlan(`E2E SCB-plan ${id}`, addDays(today, 50));
    await page.locator("summary", { hasText: "Ändra planen" }).click();
    const savePlan = page.getByRole("button", { name: "Spara" });
    await waitForHydration(page, savePlan);
    await forgeId(savePlan, plan);
    await savePlan.click();
    await page.getByText(FORBIDDEN).waitFor();

    // Samma sak för stegen: ett steg i någon annans plan går inte att ändra.
    const ownStepEdit = page.locator("article").getByRole("button", { name: /^Ändra / }).first();
    await ownStepEdit.click();
    const saveStep = page.locator("article li").getByRole("button", { name: "Spara" }).first();
    await waitForHydration(page, saveStep);
    await forgeId(saveStep, adminStep);
    await saveStep.click();
    await page.locator("article li").getByText(FORBIDDEN).waitFor();
    await switchAccount(page, ADMIN);
    await page.goto(`${BASE}/admin/projektplaner/${plan}`);
    await page.getByRole("heading", { name: planTitle }).waitFor();
  });

  await step("Behörighet: den som inte är inloggad kommer inte in", async () => {
    const { context, page: visitor } = await newVisitor(browser);
    try {
      for (const path of ["/admin/arshjul", "/admin/arshjul/ny", "/admin/projektplaner", `/admin/projektplaner/${plan}`]) {
        await visitor.goto(`${BASE}${path}`);
        await visitor.waitForURL(/\/logga-in/);
      }
    } finally {
      await context.close();
    }
  });
}
