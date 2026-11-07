// Det en admin skriver under Inställningar, så som det faktiskt skrivs: stjärnor runt ord på startsidan och i sidfoten, och meddelandet
// som flyter längst ned på sidorna. Produktionen hade **fetstil** i sina texter och ett meddelande ovanpå heron, och inget prov såg det.
import assert from "node:assert";
import { newVisitor, uniqueId, waitForHydration } from "../e2e-hjalp.mjs";

const ADMIN = "admin@statlin.se";
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const FIELDS = ["hero_kicker", "hero_text", "tagline", "announcement"];
/** Meddelandet visas 1200 ms efter hydreringen. Det här är gott om tid för att säga att det inte kommer. */
const PILL_DELAY = 2000;

export default async function meddelandeSteg({ BASE, browser, page, step, switchAccount }) {
  const notice = `Årsmöte ${uniqueId()}: läs handlingarna`;
  const original = {};

  const openSettings = async () => {
    await page.goto(`${BASE}/admin/installningar`);
    await waitForHydration(page, page.locator("#announcement"));
  };
  const save = async (values) => {
    await openSettings();
    for (const [name, value] of Object.entries(values)) await page.locator(`#${name}`).fill(value);
    await page.getByRole("button", { name: "Spara", exact: true }).click();
    await page.getByText("Inställningarna är sparade.").waitFor();
  };
  /** Scrollar direkt, utan mjuk scrollning, så att heroens nederkant står på andelen `del` av skärmens höjd. */
  const heroBottomAt = (p, del) =>
    p.evaluate((del) => {
      const hero = document.querySelector("section[data-startsida]");
      window.scrollTo({ top: hero.getBoundingClientRect().bottom + window.scrollY - window.innerHeight * del, behavior: "instant" });
    }, del);
  /** Sidan är klar när React har tagit över sidfoten, och då räknas meddelandets väntan därifrån. */
  const openAsVisitor = async (p, url) => {
    await p.goto(`${BASE}${url}`);
    await waitForHydration(p, p.locator("footer a").first());
  };

  await step("Stjärnor i startsidans texter och i sidfoten blir framhävda ord, och själva stjärnorna syns inte", async () => {
    await switchAccount(page, ADMIN);
    await openSettings();
    for (const name of FIELDS) original[name] = await page.locator(`#${name}`).inputValue();

    await save({
      hero_kicker: "Statistiksektionen i *Linköping*",
      hero_text: "Sittningar och pubar. **Drivet av studenter.**",
      // Så stod det i produktionen: dubbla stjärnor med ett mellanslag före de avslutande.
      tagline: "Du som läser **Statistics and Machine Learning ** vid LiU",
    });

    const { context, page: p } = await newVisitor(browser);
    await openAsVisitor(p, "/");
    const sentence = p.locator("p", { hasText: "Sittningar och pubar." });
    await sentence.waitFor();
    assert.equal(await sentence.innerText(), "Sittningar och pubar. Drivet av studenter.");
    // I heron framhävs orden i bläckets färg mot den grå texten. Bara rubriken har röda ord.
    assert.equal(await sentence.locator(".text-ink").innerText(), "Drivet av studenter.");
    await p.locator(".text-ink", { hasText: /^Linköping$/ }).first().waitFor({ state: "attached" });

    const footer = await p.locator("footer").innerText();
    assert.ok(footer.includes("Du som läser Statistics and Machine Learning vid LiU"), "sloganen ska stå utan stjärnor i sidfoten");
    assert.ok(!footer.includes("*"), "inga stjärnor i sidfoten");
    await context.close();
  });

  await step("Meddelandet väntar tills heron är förbi, på dator och telefon, och syns direkt på andra sidor", async () => {
    await save({ announcement: notice });

    for (const options of [{}, PHONE]) {
      const { context, page: p } = await newVisitor(browser, options);
      const pill = p.getByRole("status").filter({ hasText: notice });

      await openAsVisitor(p, "/");
      await p.waitForTimeout(PILL_DELAY);
      assert.equal(await pill.count(), 0, "meddelandet får inte ligga över heron");

      // Heron är längre på telefonen, med texten om sektionen och siffrorna. Så länge den når ner till skärmens nederkant väntar meddelandet.
      await heroBottomAt(p, 0.97);
      await p.waitForTimeout(400);
      assert.equal(await pill.count(), 0, "meddelandet får inte ligga över slutet av heron");

      await heroBottomAt(p, 0.5);
      await pill.waitFor();

      // Tillbaka upp: knapparna ska gå att nå igen, utan något ovanpå.
      await p.evaluate(() => window.scrollTo(0, 0));
      await pill.waitFor({ state: "detached" });

      await openAsVisitor(p, "/kontakt");
      await pill.waitFor();

      await p.getByRole("button", { name: "Stäng meddelandet" }).click();
      await pill.waitFor({ state: "detached" });
      await p.reload();
      await waitForHydration(p, p.locator("footer a").first());
      await p.waitForTimeout(PILL_DELAY);
      assert.equal(await pill.count(), 0, "ett stängt meddelande ska stanna stängt");
      await context.close();
    }
  });

  await step("Inbjudan till STAR går till företag, så meddelanden till medlemmarna syns inte där", async () => {
    await page.goto(`${BASE}/admin/star`);
    const link = page.locator('input[aria-label="Inbjudningslänk"]');
    await link.waitFor();
    const invitePath = new URL(await link.inputValue()).pathname;

    const { context, page: p } = await newVisitor(browser);
    await openAsVisitor(p, invitePath);
    await p.getByRole("heading", { name: "Var med på STAR" }).waitFor();
    await p.waitForTimeout(PILL_DELAY);
    assert.equal(await p.getByRole("status").filter({ hasText: notice }).count(), 0);
    await context.close();

    // Tillbaka till det som stod, så att senare steg inte påverkas.
    await save(original);
    await openSettings();
    for (const name of FIELDS) assert.equal(await page.locator(`#${name}`).inputValue(), original[name]);
  });
}
