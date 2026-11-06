// Företagssidan och inbjudan till STAR: programmen först, bläddringen genom utbildningen, den privata länken, intresseanmälan och notisen
// i portalen. Mejlet provas i tests/star-intresse.test.mjs, eftersom testservern inte har någon SMTP.
import assert from "node:assert";
import { newVisitor, uniqueId, waitForHydration } from "../e2e-hjalp.mjs";
import { sasuAccount } from "./naringsliv.mjs";

const ADMIN = "admin@statlin.se";
const OTHER_COMMITTEE = "scb@statlin.se";
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const MENU_LINK = 'nav[aria-label="Adminmeny"]:visible a[href="/admin/intresseanmalningar"]';

const levelText = (p, level) => p.locator(`#kompetens [data-niva="${level}"]`);
const skill = (p, name) => p.locator("#kompetens li[data-lage]", { hasText: name }).first();
const stepLabel = (p, name) => p.locator("#kompetens fieldset label", { hasText: name });
const pickerInView = (p) =>
  p.waitForFunction(() => {
    const r = document.querySelector("#kompetens fieldset").getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  });

// Med strömmad rendering hinner statuskoden bli 200 innan koden har kontrollerats, precis som för okända evenemang och nyheter.
// Det som räknas är att inget av inbjudan syns och att sidan inte indexeras.
async function assertNoInvite(p, url) {
  await p.goto(url);
  await p.getByRole("heading", { name: /^Utanför konfidens/ }).waitFor();
  assert.equal(await p.getByRole("heading", { name: "Var med på STAR" }).count(), 0, "inbjudan får inte synas med fel kod");
  assert.match(await p.locator('meta[name="robots"]').first().getAttribute("content"), /noindex/);
}

export default async function foretagSteg({ BASE, browser, page, step, switchAccount }) {
  const id = uniqueId();
  const company = `Exempelbolaget ${id}`;
  const quietCompany = `Tyst Bolag ${id}`;
  const bot = `Robot AB ${id}`;
  let invitePath;

  await step("Företagssidan: programmen kommer före allt annat, och stegen går att bläddra i", async () => {
    const { page: p, context } = await newVisitor(browser);
    await p.goto(`${BASE}/foretag`);
    await p.getByRole("heading", { name: "De bygger modellen." }).waitFor();
    await p.getByRole("heading", { name: "Statistik och dataanalys" }).waitFor();
    await p.getByRole("heading", { name: "Statistics and Machine Learning" }).waitFor();
    const first = await p.evaluate(() => {
      const skills = document.querySelector("#kompetens");
      const body = [...document.querySelectorAll("main h2")].find((h) => h.textContent.includes("Det här kan vi göra tillsammans"));
      return Boolean(skills.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    assert.ok(first, "studenterna ska komma före den allmänna texten");

    const year1 = stepLabel(p, "År 1");
    await waitForHydration(p, year1);
    await year1.click();
    await levelText(p, "ar1").waitFor();
    assert.equal(await skill(p, "Djupinlärning").getAttribute("data-lage"), "n");
    assert.equal(await skill(p, "Kvantitativ analys").getAttribute("data-lage"), "j", "kvantitativ analys ska stå utskrivet");
    assert.equal(await skill(p, "Tidsserieanalys").getAttribute("data-lage"), "n");

    await p.getByRole("button", { name: "Nästa steg: År 2" }).click();
    await levelText(p, "ar2").waitFor();
    assert.equal(await skill(p, "Regressionsanalys").getAttribute("data-ny"), "true", "det nya i steget ska vara markerat");
    assert.equal(await skill(p, "Tidsserieanalys").getAttribute("data-lage"), "j", "tidsserieanalys ska stå utskrivet och ingå från andra året");
    assert.equal(await skill(p, "Hypotesprövning").getAttribute("data-ny"), null, "det som fanns förut ska inte vara markerat");

    await stepLabel(p, "Master").click();
    await levelText(p, "master").waitFor();
    assert.equal(await skill(p, "Djupinlärning").getAttribute("data-lage"), "j");
    await p.getByText("32", { exact: true }).waitFor();

    await p.getByRole("button", { name: "Föregående steg: Kandidat" }).click();
    await levelText(p, "kandidat").waitFor();

    // Knappen på programkortet väljer programmets steg och scrollar dit.
    await stepLabel(p, "År 1").click();
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator("#kompetens li", { hasText: "Statistics and Machine Learning" }).getByRole("button", { name: "Se vad de kan" }).click();
    await levelText(p, "master").waitFor();
    await pickerInView(p);

    // Guldkornen ur planerna ligger sist, och väljaren följer inte med dit.
    const gems = p.getByRole("heading", { name: "Det som sällan står i ett CV" });
    await gems.scrollIntoViewIfNeeded();
    await p.getByRole("heading", { name: "Uppsatsen kan lösa ert problem" }).waitFor();
    await context.close();
  });

  await step("Bläddraren går igenom stegen när den kommer i bild, men inte för den som har stängt av rörelser", async () => {
    const center = (p) =>
      p.evaluate(() => {
        const picker = document.querySelector("#kompetens fieldset").parentElement;
        window.scrollTo(0, picker.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3);
      });
    const moving = await newVisitor(browser);
    await moving.page.goto(`${BASE}/foretag`);
    await levelText(moving.page, "ar1").waitFor();
    await center(moving.page);
    await levelText(moving.page, "ar2").waitFor();
    await levelText(moving.page, "master").waitFor({ timeout: 8000 });
    await moving.context.close();

    // Ett klick på steget som redan visas ger ingen change, men ska ändå stoppa genomgången.
    const stopped = await newVisitor(browser);
    await stopped.page.goto(`${BASE}/foretag`);
    await levelText(stopped.page, "ar1").waitFor();
    await center(stopped.page);
    await stepLabel(stopped.page, "År 1").click();
    await stopped.page.waitForTimeout(2300);
    assert.ok(await levelText(stopped.page, "ar1").isVisible(), "klicket ska stoppa genomgången på steget man valde");
    await stopped.context.close();

    const calm = await newVisitor(browser, { reducedMotion: "reduce" });
    await calm.page.goto(`${BASE}/foretag`);
    await waitForHydration(calm.page, stepLabel(calm.page, "År 1"));
    await center(calm.page);
    await calm.page.waitForTimeout(1200);
    assert.ok(await levelText(calm.page, "master").isVisible(), "utan rörelser ska det starkaste steget visas direkt");
    await calm.context.close();
  });

  await step("Företagssidan på telefon: väljaren följer med, och inget går utanför skärmen", async () => {
    const { page: p, context } = await newVisitor(browser, PHONE);
    await p.goto(`${BASE}/foretag`);
    await waitForHydration(p, stepLabel(p, "År 1"));
    await p.waitForLoadState("networkidle");
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390, "sidan ska inte gå att scrolla åt sidan");
    await p.evaluate(() => {
      const last = [...document.querySelectorAll("#kompetens li[data-lage]")].pop();
      window.scrollTo(0, last.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.6);
    });
    await pickerInView(p);
    await stepLabel(p, "År 2").click();
    await levelText(p, "ar2").waitFor();
    assert.equal(await skill(p, "Big data").getAttribute("data-lage"), "n");
    await context.close();
  });

  await step("Menyvalet Vad studenterna kan landar vid kunskaperna, också när sidan strömmas in efter att den öppnats", async () => {
    // Lokalt svarar servern så fort att innehållet hinner med. Den riktiga sajten gör inte det, och där blev man kvar högst upp.
    const landed = async (p) => {
      await p.waitForFunction(() => {
        const section = document.querySelector("#kompetens")?.getBoundingClientRect();
        const header = document.querySelector("header").getBoundingClientRect();
        return section && section.top >= header.bottom - 8 && section.top < window.innerHeight / 2;
      });
    };
    for (const options of [{}, PHONE]) {
      const { page: p, context } = await newVisitor(browser, options);
      await p.route("**/foretag*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 900));
        await route.continue();
      });
      await p.goto(`${BASE}/`);
      await waitForHydration(p, p.locator("footer a").first());
      // Menyernas grupper är details: Företag fälls ut i telefonens meny och i datorns sidomeny.
      if (options.isMobile) {
        await p.getByRole("button", { name: "Öppna meny" }).click();
        await p.locator("#mobilmeny summary", { hasText: "Företag" }).click();
      } else {
        await p.locator("aside nav summary", { hasText: "Företag" }).click();
      }
      const menuLink = p.locator('a[href="/foretag#kompetens"]:visible').first();
      await menuLink.waitFor();
      // Länken förhämtar sidans skal. Klicket visar då skalet direkt, och innehållet kommer efter, precis som på den riktiga sajten.
      await p.waitForTimeout(1500);
      await menuLink.click();
      await p.waitForURL(/\/foretag#kompetens$/);
      await landed(p);

      // Bakåt från en annan sida ska lämna besökaren där den var, och inte dra tillbaka den till ankaret.
      await p.evaluate(() => window.scrollBy(0, 1500));
      const before = await p.evaluate(() => window.scrollY);
      await p.locator('a[href="/lunchforelasningar"]:visible').first().evaluate((a) => a.click());
      await p.waitForURL(/\/lunchforelasningar/);
      await p.goBack();
      await p.waitForURL(/\/foretag#kompetens$/);
      await p.waitForTimeout(800);
      const after = await p.evaluate(() => window.scrollY);
      assert.ok(Math.abs(after - before) < 120, `bakåt hoppade från ${before} till ${after}`);
      await context.close();
    }
  });

  await step("Inbjudningslänken: kommer från admin, sökmotorer ser den inte, och fel kod visar ingenting", async () => {
    await switchAccount(page, ADMIN);
    await page.goto(`${BASE}/admin/star`);
    const link = page.locator('input[aria-label="Inbjudningslänk"]');
    await link.waitFor();
    invitePath = new URL(await link.inputValue()).pathname;
    assert.match(invitePath, /^\/star\/inbjudan\/[0-9a-f]{24}$/);

    const { page: p, context } = await newVisitor(browser);
    assert.equal((await p.goto(`${BASE}${invitePath}`)).status(), 200);
    assert.match(await p.locator('meta[name="robots"]').first().getAttribute("content"), /noindex/);
    await p.getByRole("heading", { name: "Var med på STAR" }).waitFor();
    await p.getByRole("heading", { name: "Statistics and Machine Learning" }).waitFor();
    await assertNoInvite(p, `${BASE}/star/inbjudan/fel-kod`);
    const sitemap = await (await p.request.get(`${BASE}/sitemap.xml`)).text();
    assert.ok(!sitemap.includes("inbjudan"), "länken ska inte stå i sitemapen");
    await context.close();
  });

  await step("Intresseanmälan: fel behåller texten, tappat nät tar inte sidan med sig, och mötet går att önska", async () => {
    const { page: p, context } = await newVisitor(browser);
    await p.goto(`${BASE}${invitePath}`);
    const submit = p.getByRole("button", { name: "Skicka intresseanmälan" });
    await waitForHydration(p, submit);
    await p.fill('input[name="foretag"]', company);
    await p.fill('input[name="kontakt_namn"]', "Alex Exempel");

    // Webbläsaren stoppar en felaktig adress, så här måste servern själv få säga nej.
    await p.evaluate(() => {
      document.querySelector('input[name="epost"]').form.noValidate = true;
    });
    await p.fill('input[name="epost"]', "inte-en-adress");
    await submit.click();
    await p.locator("#intresse-epost-fel").waitFor();
    assert.equal(await p.inputValue('input[name="foretag"]'), company, "det skrivna ska finnas kvar efter ett fel");

    await p.fill('input[name="epost"]', "alex@example.com");
    const when = p.locator('input[name="moteforslag"]');
    assert.equal(await when.isVisible(), false, "fältet för tiden ska vara dolt tills man vill boka möte");
    await p.getByText("Vi vill boka ett möte").click();
    await when.waitFor();
    await when.fill("Tisdagar efter lunch");
    await p.fill('textarea[name="meddelande"]', "Vi söker exjobbare.");

    const offline = (route) => (route.request().method() === "POST" ? route.abort() : route.continue());
    await p.route(`**${invitePath}**`, offline);
    await submit.click();
    await p.getByText("Det gick inte att nå servern").waitFor();
    assert.equal(await when.inputValue(), "Tisdagar efter lunch", "det skrivna ska finnas kvar när nätet försvinner");
    await p.unroute(`**${invitePath}**`, offline);

    await submit.click();
    await p.waitForURL(/tack=mote/);
    await p.getByText("Tack, nu har SASU er anmälan").waitFor();
    await p.getByText("hitta en tid för mötet").waitFor();

    // Samma anmälan en gång till blir ingen ny rad.
    await p.goto(`${BASE}${invitePath}`);
    await waitForHydration(p, submit);
    await p.fill('input[name="foretag"]', company);
    await p.fill('input[name="kontakt_namn"]', "Alex Exempel");
    await p.fill('input[name="epost"]', "alex@example.com");
    await p.fill('textarea[name="meddelande"]', "Vi söker exjobbare.");
    await submit.click();
    await p.waitForURL(/tack=/);
    await context.close();
  });

  await step("Intresseanmälan utan JavaScript, och en bot som fyller i det dolda fältet", async () => {
    const { page: p, context } = await newVisitor(browser, { javaScriptEnabled: false });
    await p.goto(`${BASE}${invitePath}`);
    await p.fill('input[name="foretag"]', quietCompany);
    await p.fill('input[name="kontakt_namn"]', "Sam Tyst");
    await p.fill('input[name="epost"]', "sam@example.com");
    await p.getByRole("button", { name: "Skicka intresseanmälan" }).click();
    await p.waitForURL(/tack=1/);
    await p.getByText("Tack, nu har SASU er anmälan").waitFor();

    await p.goto(`${BASE}${invitePath}`);
    await p.fill('input[name="foretag"]', bot);
    await p.fill('input[name="kontakt_namn"]', "Robot");
    await p.fill('input[name="epost"]', "robot@example.com");
    await p.locator('input[name="webbplats"]').fill("https://example.com");
    await p.getByRole("button", { name: "Skicka intresseanmälan" }).click();
    await p.waitForURL(/tack=1/);
    await context.close();
  });

  await step("Anmälan syns direkt: notis i menyn och på översikten för admin och SASU, andra utskott stoppas", async () => {
    await page.goto(`${BASE}/admin`);
    assert.match(await page.locator(MENU_LINK).innerText(), /\d/, "menyraden ska visa antalet nya");
    await page.getByText(/intresseanmäl(an|ningar) till STAR/).first().waitFor();

    await page.goto(`${BASE}/admin/intresseanmalningar`);
    const card = page.locator("li", { hasText: company });
    await card.first().waitFor();
    assert.equal(await card.count(), 1, "samma anmälan två gånger ska bli en rad");
    await card.getByText("Vill boka möte").waitFor();
    await card.getByText("Tisdagar efter lunch").waitFor();
    await card.getByText("Vi söker exjobbare.").waitFor();
    await page.locator("li", { hasText: quietCompany }).first().waitFor();
    assert.equal(await page.locator("li", { hasText: bot }).count(), 0, "boten ska inte hamna i listan");
    assert.equal(await card.getByRole("link", { name: "Svara" }).getAttribute("href").then((h) => h.startsWith("mailto:alex@example.com")), true);

    const sasu = await sasuAccount(page, browser, BASE);
    await sasu.page.goto(`${BASE}/admin`);
    assert.match(await sasu.page.locator(MENU_LINK).innerText(), /\d/, "SASU ska se notisen");
    await sasu.page.goto(`${BASE}/admin/intresseanmalningar`);
    const sasuCard = sasu.page.locator("li", { hasText: company });
    await sasuCard.first().waitFor();

    // SASU hanterar anmälan, ångrar sig och tar bort den.
    const handled = sasuCard.getByRole("button", { name: "Markera som hanterad" });
    await waitForHydration(sasu.page, handled);
    await handled.click();
    await sasu.page.getByText("Anmälan är markerad som hanterad.").waitFor();
    await sasu.page.getByRole("link", { name: /^Hanterade/ }).click();
    await sasu.page.waitForURL(/flik=hanterade/);
    const moveBack = sasu.page.locator("li", { hasText: company }).getByRole("button", { name: "Flytta till nya" });
    await waitForHydration(sasu.page, moveBack);
    await moveBack.click();
    await sasu.page.getByText("Anmälan ligger bland de nya igen.").waitFor();
    const remove = sasu.page.locator("li", { hasText: company }).getByRole("button", { name: "Ta bort" });
    await waitForHydration(sasu.page, remove);
    await remove.click();
    await sasu.page.getByRole("alertdialog").getByRole("button", { name: "Ta bort" }).click();
    await sasu.page.getByText("Anmälan är borttagen.").waitFor();
    assert.equal(await sasu.page.locator("li", { hasText: company }).count(), 0);
    await sasu.context.close();

    await switchAccount(page, OTHER_COMMITTEE);
    await page.goto(`${BASE}/admin/intresseanmalningar`);
    await page.waitForURL(/\/admin\?nekad=1/);
    assert.equal(await page.locator(MENU_LINK).count(), 0, "ett annat utskott ska inte ha menyraden");
    const anon = await newVisitor(browser);
    await anon.page.goto(`${BASE}/admin/intresseanmalningar`);
    await anon.page.waitForURL(/\/logga-in/);
    await anon.context.close();
    await switchAccount(page, ADMIN);
  });

  await step("Byt länk: den gamla slutar fungera direkt och den nya fungerar", async () => {
    await page.goto(`${BASE}/admin/star`);
    const renew = page.getByRole("button", { name: "Byt länk" });
    await waitForHydration(page, renew);
    await renew.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Byt länk" }).click();
    await page.waitForURL(/nylank=1/);
    const fresh = new URL(await page.locator('input[aria-label="Inbjudningslänk"]').inputValue()).pathname;
    assert.notEqual(fresh, invitePath, "länken ska ha bytts");
    const { page: p, context } = await newVisitor(browser);
    await assertNoInvite(p, `${BASE}${invitePath}`);
    assert.equal((await p.goto(`${BASE}${fresh}`)).status(), 200, "den nya länken");
    await context.close();
  });
}
