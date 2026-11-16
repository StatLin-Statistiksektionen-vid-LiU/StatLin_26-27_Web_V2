// Kontoskydden: väntan efter fel lösenord, spärren per IP, tvångsbytet, avstängda konton, ursprungskontrollen och sista administratören.
// Stegen skapar egna konton och loggar in från egna IP-adresser. Så tär de inte på svitens 20 försök, och de kan köras i vilken ordning som helst.
import assert from "node:assert";
import { changeTemporaryPassword, createEditor, newVisitor, openLogin, tryLogin, uniqueId, waitForHydration } from "../e2e-hjalp.mjs";

const ADMIN = "admin@statlin.se";
const WRONG = "inte-det-har-losenordet";
const DENIED = "Fel e-postadress eller lösenord.";
const LOGGED_IN_API = "/api/admin/redigera?typ=home";

export default async function kontoSteg({ BASE, browser, page, step, switchAccount }) {
  /** Öppnar kontot i adminpanelen och svarar med sidans adress. */
  const openAccount = async (email) => {
    await page.goto(`${BASE}/admin/konton`);
    await page.goto(`${BASE}${await page.getByRole("link", { name: email }).getAttribute("href")}`);
    await waitForHydration(page, page.getByRole("button", { name: "Spara konto" }));
  };

  /** Växlar Aktivt konto och sparar. Kryssrutan är osynlig, så klicket går på dess etikett. */
  const toggleActive = () => page.locator('label:has(input[name="active"])').click();

  const setAccountActive = async (email, active) => {
    await openAccount(email);
    await toggleActive();
    assert.equal(await page.locator('input[name="active"]').isChecked(), active);
    await page.getByRole("button", { name: "Spara konto" }).click();
    await page.getByText("Kontot är sparat.").waitFor();
  };

  await step("Inloggningen väntar allt längre efter upprepade fel, men bara från samma IP", async () => {
    await switchAccount(page, ADMIN);
    const { email, password } = await createEditor(page, BASE);
    const guesser = await newVisitor(browser);
    await openLogin(guesser.page, BASE);
    for (let i = 1; i <= 4; i++) assert.equal(await tryLogin(guesser.page, email, WRONG), DENIED, `fel lösenord ${i}`);
    // Väntan räknas från felet: 2 sekunder efter det fjärde, 4 efter det femte och 8 efter det sjätte.
    await guesser.page.waitForTimeout(2100);
    assert.equal(await tryLogin(guesser.page, email, WRONG), DENIED, "fel lösenord 5");
    await guesser.page.waitForTimeout(4100);
    assert.equal(await tryLogin(guesser.page, email, WRONG), DENIED, "fel lösenord 6");
    const lastFailure = Date.now();
    // Halvvägs in i väntan: rätt lösenord prövas inte, och svaret är detsamma som för fel lösenord.
    await guesser.page.waitForTimeout(4100);
    assert.equal(await tryLogin(guesser.page, email, password), DENIED, "rätt lösenord ska inte prövas under väntan");
    const other = await newVisitor(browser);
    await openLogin(other.page, BASE);
    assert.equal(await tryLogin(other.page, email, password), null, "en annan IP ska inte behöva vänta");
    await other.context.close();
    await guesser.page.waitForTimeout(Math.max(0, lastFailure + 8100 - Date.now()));
    assert.equal(await tryLogin(guesser.page, email, password), null, "efter väntan ska rätt lösenord fungera");
    await guesser.context.close();
  });

  await step("Försök 21 från samma IP nekas även med rätt lösenord, medan andra IP-adresser släpps in", async () => {
    await switchAccount(page, ADMIN);
    const { email, password } = await createEditor(page, BASE);
    const flooder = await newVisitor(browser);
    await openLogin(flooder.page, BASE);
    for (let i = 1; i <= 20; i++) assert.equal(await tryLogin(flooder.page, `okand-${uniqueId()}@statlin.se`, WRONG), DENIED, `försök ${i}`);
    assert.equal(await tryLogin(flooder.page, email, password), "För många inloggningsförsök. Vänta en stund och försök igen.", "försök 21");
    await flooder.context.close();
    const other = await newVisitor(browser);
    await openLogin(other.page, BASE);
    assert.equal(await tryLogin(other.page, email, password), null, "en annan IP ska släppas in");
    await other.context.close();
  });

  await step("Ett konto med tillfälligt lösenord når ingenting förrän lösenordet är bytt", async () => {
    await switchAccount(page, ADMIN);
    const { email, password } = await createEditor(page, BASE);
    const person = await newVisitor(browser);
    await openLogin(person.page, BASE);
    assert.equal(await tryLogin(person.page, email, password), null, "det tillfälliga lösenordet ska fungera");
    await person.page.waitForURL(/\/admin\/konto\?byt=1/);
    for (const path of ["/admin", "/admin/nyheter", "/admin/nyheter/ny"]) {
      await person.page.goto(`${BASE}${path}`);
      await person.page.waitForURL(/\/admin\/konto\?byt=1/);
    }
    assert.equal((await person.context.request.get(`${BASE}${LOGGED_IN_API}`)).status(), 403, "redigeringens API");
    const upload = () => person.page.evaluate(() => fetch("/api/admin/upload", { method: "POST", body: new FormData() }).then((r) => r.status));
    assert.equal(await upload(), 403, "uppladdningen");
    // Servern ska neka också ett formulär som redan står öppet. Sidan öppnas bara för ett vanligt konto, så administratören öppnar den
    // och kakan byts innan formuläret skickas.
    const form = await newVisitor(browser);
    await form.context.addCookies(await page.context().cookies());
    await form.page.goto(`${BASE}/admin/nyheter/ny`);
    await waitForHydration(form.page, form.page.locator('input[name="title"]'));
    await form.context.clearCookies();
    await form.context.addCookies(await person.context.cookies());
    await form.page.fill('input[name="title"]', `Ska inte sparas ${uniqueId()}`);
    await form.page.getByRole("button", { name: "Spara som utkast" }).click();
    await form.page.getByText("Byt ditt tillfälliga lösenord under Mitt konto innan du sparar.").waitFor();
    await form.context.close();

    await changeTemporaryPassword(person.page, password);
    // Bytet leder rakt in på översikten, och inget på sidan pratar om lösenordet längre än beskedet.
    await person.page.waitForURL(/\/admin\?valkommen=1$/);
    // Hälsningen följer klockan.
    await person.page.getByRole("heading", { name: /^(Hej|God morgon|God kväll|Uppe sent), / }).waitFor();
    assert.equal(await person.page.getByText("tillfälligt lösenord").filter({ visible: true }).count(), 0, "bannern om lösenordet ska vara borta");
    assert.equal((await person.context.request.get(`${BASE}${LOGGED_IN_API}`)).status(), 200, "redigeringens API efter bytet");
    await person.context.close();
  });

  await step("Ett konto som stängs av förlorar en levande session direkt och kan inte logga in", async () => {
    await switchAccount(page, ADMIN);
    const { email, password } = await createEditor(page, BASE);
    const person = await newVisitor(browser);
    await openLogin(person.page, BASE);
    assert.equal(await tryLogin(person.page, email, password), null, "det tillfälliga lösenordet ska fungera");
    const newPassword = await changeTemporaryPassword(person.page, password);
    assert.equal((await person.context.request.get(`${BASE}${LOGGED_IN_API}`)).status(), 200, "redigeringens API med levande session");
    const liveSession = await person.context.cookies();
    // Personen har ett formulär öppet när kontot stängs av.
    await person.page.goto(`${BASE}/admin/nyheter/ny`);
    await waitForHydration(person.page, person.page.locator('input[name="title"]'));

    await setAccountActive(email, false);
    await person.page.fill('input[name="title"]', `Ska inte sparas ${uniqueId()}`);
    await person.page.getByRole("button", { name: "Spara som utkast" }).click();
    await person.page.getByText("Du har loggats ut. Logga in i en ny flik och försök igen.").waitFor();
    assert.equal((await person.context.request.get(`${BASE}${LOGGED_IN_API}`)).status(), 401, "redigeringens API efter avstängningen");
    await person.page.goto(`${BASE}/admin`);
    await person.page.waitForURL(/\/logga-in/);
    // Bara den som kan lösenordet får veta att kontot är avstängt.
    await waitForHydration(person.page, person.page.locator("#email"));
    assert.equal(await tryLogin(person.page, email, WRONG), DENIED, "fel lösenord på ett avstängt konto");
    assert.equal(await tryLogin(person.page, email, newPassword), "Kontot är avstängt. Kontakta en administratör.", "rätt lösenord på ett avstängt konto");

    // Sessionen kommer inte tillbaka när kontot öppnas igen. Det krävs en ny inloggning.
    await setAccountActive(email, true);
    await person.context.addCookies(liveSession);
    await person.page.goto(`${BASE}/admin`);
    await person.page.waitForURL(/\/logga-in/);
    await waitForHydration(person.page, person.page.locator("#email"));
    assert.equal(await tryLogin(person.page, email, newPassword), null, "ett öppnat konto ska kunna logga in");
    await person.context.close();
  });

  await step("Uppladdning nekas utan rätt ursprung, även för den som är inloggad", async () => {
    await switchAccount(page, ADMIN);
    const file = { name: "ursprung.txt", mimeType: "text/plain", buffer: Buffer.from("ursprung") };
    const upload = async (headers, multipart = { file }) => (await page.context().request.post(`${BASE}/api/admin/upload`, { headers, multipart })).status();
    assert.equal(await upload({}), 403, "utan Origin");
    assert.equal(await upload({ origin: "https://example.com" }), 403, "från en annan sajt");
    assert.equal(await upload({ origin: "null" }), 403, "från en sandlådad sida");
    // Samma anrop från sajten själv kommer förbi spärren och nekas först för att filen saknas.
    assert.equal(await upload({ origin: new URL(BASE).origin }, { inget: "fält" }), 400, "från sajten själv");
  });

  await step("Ett formulär som skickas från ett annat ursprung sparas inte", async () => {
    await switchAccount(page, ADMIN);
    const admin = await newVisitor(browser);
    await admin.context.addCookies(await page.context().cookies());
    await admin.page.goto(`${BASE}/admin/nyheter/ny`);
    await waitForHydration(admin.page, admin.page.locator('input[name="title"]'));
    // Anropet skickas från Node, eftersom webbläsaren behåller sitt eget Origin även när route.continue får ett annat.
    await admin.page.route(
      (url) => url.pathname === "/admin/nyheter/ny",
      async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const headers = { ...(await route.request().allHeaders()), origin: "https://example.com" };
        await route.fulfill({ response: await route.fetch({ headers }) });
      },
    );
    const title = `Från annat ursprung ${uniqueId()}`;
    await admin.page.fill('input[name="title"]', title);
    await admin.page.getByRole("button", { name: "Spara som utkast" }).click();
    await admin.page.getByText("Kunde inte spara. Försök igen.").waitFor();
    await admin.page.unrouteAll();
    await admin.page.goto(`${BASE}/admin/nyheter`);
    await admin.page.getByRole("heading", { name: "Nytt" }).first().waitFor();
    assert.equal(await admin.page.getByText(title).count(), 0, "nyheten ska inte ha sparats");
    await admin.context.close();
  });

  await step("Den sista administratören kan inte stängas av eller bli redaktör", async () => {
    await switchAccount(page, ADMIN);
    await page.goto(`${BASE}/admin/konton`);
    assert.equal(await page.locator("ul .chip", { hasText: "Administratör" }).count(), 1, "steget förutsätter att det bara finns en administratör");
    const refused = "Det måste finnas minst en aktiv administratör.";
    await openAccount(ADMIN);
    await toggleActive();
    await page.getByRole("button", { name: "Spara konto" }).click();
    await page.getByText(refused).waitFor();

    await openAccount(ADMIN);
    await page.locator('label:has(input[name="role"][value="editor"])').click();
    await page.getByRole("button", { name: "Spara konto" }).click();
    await page.getByText(refused).waitFor();

    await openAccount(ADMIN);
    assert.ok(await page.locator('input[name="active"]').isChecked(), "kontot ska vara aktivt");
    assert.ok(await page.locator('input[name="role"][value="admin"]').isChecked(), "kontot ska vara administratör");
  });
}
