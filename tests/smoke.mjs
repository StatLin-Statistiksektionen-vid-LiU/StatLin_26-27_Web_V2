// Snabbkontroll av en körande sajt: ändrar ingenting och är därför säker att köra mot produktion – efter varje
// driftsättning, uppgradering eller byte av värd. Kräver bara Node. Det enda den skickar är tomma POST-anrop utan inloggning
// till uppladdningen, och de nekas innan något händer.
//
//   node tests/smoke.mjs https://statlin.se
//
// Kontrollerar att de publika sidorna svarar utan fel (även länksidan och tentastatistiken), att hälsokontrollen, kalenderflödet,
// sitemap och robots.txt fungerar, att adminpanelen kräver inloggning, att uppladdningen nekar andra ursprung, att mediaadresser
// inte leder ut ur uppladdningsmappen, att fliken har en ikon, att delningsmetadatan, kalenderlänken och språkversionerna finns kvar på sidor med egna block, att sidorna skickar säkerhetsrubrikerna, att sitemapen och kalenderfilerna får cachas, att evenemangens kalendervy och filter inte indexeras, och att delningsbilden, canonical, sitemap och robots.txt pekar på sajtens adress, SITE_URL (ST-20). Adressen är
// miljövariabeln SITE_URL om den är satt, annars adressen som provas. Fel adress betyder att sajten byggdes med en annan
// SITE_URL – den bakas in vid bygget, se README – eller att smoke körs mot en annan adress än den sajten byggdes med:
// kör då smoke med SITE_URL=<adressen sajten byggdes med>. Lokalt utan SITE_URL bakar layouten in reservadressen
// http://localhost:3000 (src/app/layout.tsx), medan sitemapen tar adressen ur Host – båda godtas då.

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE);
const SITE_URL = (process.env.SITE_URL || BASE).replace(/\/$/, "");
const bases = [SITE_URL, ...(IS_LOCAL && !process.env.SITE_URL ? ["http://localhost:3000"] : [])];
const onSite = (url) => bases.some((b) => url === b || url.startsWith(`${b}/`));
const REMEDY = "kör smoke med SITE_URL=<adressen sajten byggdes med>, eller bygg om med rätt SITE_URL";

const PAGES = [
  "/",
  "/evenemang",
  "/nyheter",
  "/sektionen",
  "/sektionen/styrelsen",
  "/utskott",
  "/galleri",
  "/dokument",
  "/grafisk-profil",
  "/studenter/kandidat",
  "/studenter/master",
  "/studenter/ny-student",
  "/studenter/lankar",
  "/studenter/hjalpmedel",
  "/tentastatistik",
  "/tentastatistik/732G33",
  "/foretag",
  "/kontakt",
  "/en",
  "/en/masters",
  "/integritet",
  "/logga-in",
];

const results = [];
async function check(name, fn) {
  try {
    const note = await fn();
    results.push(`✓ ${name}${note ? ` – ${note}` : ""}`);
  } catch (e) {
    results.push(`✗ ${name}: ${e.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(path, init) {
  const res = await fetch(BASE + path, { redirect: "manual", signal: AbortSignal.timeout(30_000), ...init });
  if (res.status !== 200) await res.body?.cancel();
  return { res, body: res.status === 200 ? await res.text() : "" };
}

await check("Hälsokontroll /api/health", async () => {
  const { res, body } = await get("/api/health");
  expect(res.status === 200, `status ${res.status}`);
  expect(JSON.parse(body).ok === true, `svarade ${body}`);
});

for (const path of PAGES) {
  await check(`Sidan ${path}`, async () => {
    const { res, body } = await get(path);
    expect(res.status === 200, `status ${res.status}`);
    expect(!body.includes('id="__next_error__"'), "sidan visar ett felmeddelande");
    expect(/<h1[\s>]/.test(body), "saknar rubrik (h1)");
    if (path.startsWith("/en")) expect(body.includes('lang="en"'), 'saknar lang="en"');
  });
}

await check("Kurskoder med gemener skickas till versaler", async () => {
  const { res } = await get("/tentastatistik/732g33");
  const location = res.headers.get("location") ?? "";
  expect(res.status === 308 && location.endsWith("/tentastatistik/732G33"), `status ${res.status} ${location}`);
});

await check("Webbläsarens egen fråga efter /favicon.ico leder till ikonen", async () => {
  // PDF-visaren i Chrome och Edge frågar efter den, eftersom en PDF inte kan säga var ikonen finns.
  const { res } = await get("/favicon.ico");
  const location = res.headers.get("location") ?? "";
  expect(res.status === 308 && location.endsWith("/icon.svg"), `status ${res.status} ${location}`);
});

await check("Kurskoderna till sökrutan /api/tentastatistik/koder", async () => {
  const { res, body } = await get("/api/tentastatistik/koder");
  expect(res.status === 200, `status ${res.status}`);
  const codes = JSON.parse(body);
  expect(Array.isArray(codes), "svaret är inte en lista");
  return codes.length ? `${codes.length} koder` : "tom lista – källan svarar inte just nu";
});

await check("En kurskod som inte finns kan inte indexeras, men en kurs kan det", async () => {
  // Seedens kodlista gäller också när källan är nere. Att en kurs utan sparad statistik inte får noindex när källan inte svarar kräver en egen källa (SB-19).
  const noindex = (body) => /<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(body);
  const { body: unknown } = await get("/tentastatistik/XYZ123");
  expect(noindex(unknown), "/tentastatistik/XYZ123 saknar noindex");
  const { body: known } = await get("/tentastatistik/732G33");
  expect(!noindex(known), "/tentastatistik/732G33 har noindex");
});

await check("Kalendern på startsidan", async () => {
  const { body } = await get("/");
  expect(body.includes("Hela kalendern"), "kalendern saknas");
  expect(!body.includes("marquee"), "det gamla löpbandet finns kvar");
});

await check("Språkväxlare till /en på startsidan", async () => {
  const { body } = await get("/");
  expect(/href="\/en"[^>]*hrefLang="en"|hrefLang="en"[^>]*href="\/en"/i.test(body), "länken till /en saknas");
});

await check("Delningsbild (og:image)", async () => {
  const { body } = await get("/");
  const og = body.match(/property="og:image" content="([^"]+)"/)?.[1];
  expect(og, "og:image saknas");
  expect(onSite(og), `pekar på ${og}, inte ${SITE_URL} – ${REMEDY}`);
  return og;
});

await check("Kanonisk adress (canonical)", async () => {
  const { body } = await get("/");
  const link = body.match(/<link[^>]*\srel="canonical"[^>]*>/)?.[0];
  expect(link, 'länk med rel="canonical" saknas');
  const href = link.match(/\shref="([^"]+)"/)?.[1] ?? "";
  expect(onSite(href), `pekar på ${href}, inte ${SITE_URL} – ${REMEDY}`);
  return href;
});

await check("Evenemangens kalendervy och filter indexeras inte", async () => {
  const canonical = (body) => new URL(body.match(/<link[^>]*\srel="canonical"[^>]*>/)?.[0].match(/\shref="([^"]+)"/)?.[1] ?? "/saknas", BASE).pathname;
  const noindex = (body) => /<meta[^>]*\sname="robots"[^>]*\scontent="[^"]*noindex/.test(body);
  const { body: plain } = await get("/evenemang");
  expect(canonical(plain) === "/evenemang", `/evenemang har canonical ${canonical(plain)}`);
  expect(!noindex(plain), "/evenemang ska gå att indexera");
  expect(/<link[^>]*\stype="text\/calendar"[^>]*>/.test(plain), "/evenemang har tappat länken till kalenderflödet");
  for (const query of ["?vy=kalender", "?vy=kalender&manad=1999-01", "?utskott=sasu"]) {
    const { body } = await get(`/evenemang${query}`);
    expect(canonical(body) === "/evenemang", `${query} har canonical ${canonical(body)}`);
    expect(noindex(body), `${query} saknar noindex`);
  }
});

// Metadatan slås inte ihop på djupet: en sida som sätter openGraph eller alternates ersätter hela blocket från rotlayouten (SB-02).
const metaProperty = (body, property) => body.match(new RegExp(`<meta[^>]*\\sproperty="${property}"[^>]*\\scontent="([^"]*)"`))?.[1];

await check("Sajtnamn, språk och delningsbild på evenemang och nyheter", async () => {
  const missing = [];
  for (const list of ["/evenemang", "/nyheter"]) {
    const slug = (await get(list)).body.match(new RegExp(`href="${list}/([^"/]+)"`))?.[1];
    if (!slug) {
      missing.push(`inget under ${list} att prova på`);
      continue;
    }
    const { body } = await get(`${list}/${slug}`);
    for (const property of ["og:site_name", "og:locale", "og:image"]) {
      expect(metaProperty(body, property), `${list}/${slug} saknar ${property}`);
    }
  }
  return missing.join(", ");
});

await check("Alla sidor länkar till kalenderflödet", async () => {
  for (const path of PAGES) {
    const { body } = await get(path);
    expect(/<link[^>]*\stype="text\/calendar"[^>]*>/.test(body), `${path} har tappat länken till kalenderflödet`);
  }
});

await check("Masterprogrammets två språkversioner pekar på varandra", async () => {
  const languages = (body) => new Map([...body.matchAll(/<link[^>]*\shreflang="[^"]*"[^>]*>/gi)].map(([link]) => [link.match(/hreflang="([^"]*)"/i)[1], new URL(link.match(/\shref="([^"]*)"/)[1], BASE).pathname]));
  for (const path of ["/en/masters", "/studenter/master"]) {
    const found = languages((await get(path)).body);
    expect(found.get("sv") === "/studenter/master", `${path}: hreflang sv pekar på ${found.get("sv")}`);
    expect(found.get("en") === "/en/masters", `${path}: hreflang en pekar på ${found.get("en")}`);
  }
});

await check("De engelska sidorna säger att de är engelska när de delas", async () => {
  for (const path of ["/en", "/en/masters"]) {
    const { body } = await get(path);
    expect(metaProperty(body, "og:locale") === "en_GB", `${path} har og:locale ${metaProperty(body, "og:locale")}`);
    expect(metaProperty(body, "og:site_name"), `${path} saknar og:site_name`);
    expect(metaProperty(body, "og:image"), `${path} saknar og:image`);
  }
  const { body } = await get("/");
  expect(metaProperty(body, "og:locale") === "sv_SE", `/ har og:locale ${metaProperty(body, "og:locale")}`);
});

await check("Datumen på /en/masters är på engelska", async () => {
  const { body } = await get("/en/masters");
  const swedish = body.match(/>(mån|tis|ons|tors|fre|lör|sön|Heldag[^<]*)</)?.[1];
  expect(!swedish, `/en/masters visar "${swedish}"`);
});

await check("Flikikon (rel=icon)", async () => {
  const { body } = await get("/");
  const link = body.match(/<link[^>]*\srel="(?:shortcut )?icon"[^>]*>/)?.[0];
  expect(link, 'länk med rel="icon" saknas – webbläsarfliken visar ingen ikon');
  const href = link.match(/\shref="([^"]+)"/)?.[1] ?? "";
  const { pathname, search } = new URL(href, BASE);
  const { res } = await get(pathname + search);
  expect(res.status === 200, `${href} gav status ${res.status}`);
  expect((res.headers.get("content-type") ?? "").startsWith("image/"), `${href} har content-type ${res.headers.get("content-type")}`);
  return href;
});

await check("Kalenderflöde /kalender.ics", async () => {
  const { res, body } = await get("/kalender.ics");
  expect(res.status === 200, `status ${res.status}`);
  expect((res.headers.get("content-type") ?? "").includes("text/calendar"), `content-type ${res.headers.get("content-type")}`);
  expect(body.startsWith("BEGIN:VCALENDAR"), "inte ett giltigt iCal-flöde");
});

await check("Sitemap /sitemap.xml", async () => {
  const { res, body } = await get("/sitemap.xml");
  expect(res.status === 200, `status ${res.status}`);
  expect(body.includes("<urlset"), "inte en sitemap");
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  expect(locs.length > 0, "sitemapen har inga adresser");
  const off = locs.filter((u) => !onSite(u));
  expect(off.length === 0, `${off.length} av ${locs.length} adresser börjar inte med ${SITE_URL}, t.ex. ${off[0]} – ${REMEDY}`);
  return `${locs.length} adresser`;
});

await check("robots.txt", async () => {
  const { res, body } = await get("/robots.txt");
  expect(res.status === 200, `status ${res.status}`);
  expect(body.includes("Disallow: /admin"), "adminpanelen är inte undantagen");
  // Raden finns bara när sajten byggdes med SITE_URL – lokalt utan SITE_URL får den saknas.
  const sitemap = body.match(/^Sitemap: (.+)$/m)?.[1]?.trim();
  expect(sitemap || (IS_LOCAL && !process.env.SITE_URL), "Sitemap-raden saknas – bygg om med SITE_URL");
  if (sitemap) {
    expect(bases.some((b) => sitemap === `${b}/sitemap.xml`), `Sitemap-raden är ${sitemap}, inte ${SITE_URL}/sitemap.xml – ${REMEDY}`);
  }
});

await check("Adminpanelen kräver inloggning", async () => {
  const { res } = await get("/admin");
  const location = res.headers.get("location") ?? "";
  expect(res.status >= 300 && res.status < 400 && location.includes("/logga-in"), `status ${res.status} ${location}`);
});

await check("STAR och lunchföreläsningarna svarar, och deras admin kräver inloggning", async () => {
  const { res: star, body: starBody } = await get("/star");
  expect(star.status === 200, `/star: status ${star.status}`);
  // Sidan är dold tills SASU gör den live, och då säger den bara att den kommer snart.
  expect(starBody.includes("Vilka kommer") || starBody.includes("STAR-sidan kommer snart"), "/star saknar både avsnittet Vilka kommer och beskedet om att den kommer snart");
  const { res: lunch, body: lunchBody } = await get("/lunchforelasningar");
  expect(lunch.status === 200, `/lunchforelasningar: status ${lunch.status}`);
  expect(lunchBody.includes("Önskelistan"), "/lunchforelasningar saknar önskelistan");
  for (const path of ["/admin/star", "/admin/lunchonskemal"]) {
    const { res } = await get(path);
    const location = res.headers.get("location") ?? "";
    expect(res.status >= 300 && res.status < 400 && location.includes("/logga-in"), `${path}: status ${res.status} ${location}`);
  }
});

await check("Okänd sida ger 404", async () => {
  const { res } = await get("/finns-inte-" + Date.now());
  expect(res.status === 404, `status ${res.status}`);
});

await check("Uppladdning utan rätt ursprung nekas", async () => {
  const upload = async (headers) => (await get("/api/admin/upload", { method: "POST", headers })).res.status;
  expect((await upload({})) === 403, "ett anrop utan Origin släpptes igenom");
  expect((await upload({ origin: "https://example.com" })) === 403, "ett anrop från en annan sajt släpptes igenom");
  expect((await upload({ origin: "null" })) === 403, "ett anrop från en sandlådad sida släpptes igenom");
  // Från sajten själv kommer anropet förbi spärren och nekas först för att ingen är inloggad.
  const own = await upload({ origin: new URL(BASE).origin });
  expect(own === 401, `ett anrop från sajten själv gav status ${own}, inte 401`);
});

await check("Mediaadresser kan inte leda ut ur uppladdningsmappen", async () => {
  const paths = [
    "/media/..%2f..%2fetc%2fpasswd",
    "/media/..%2fstatlin.db",
    "/media/%2e%2e%2fstatlin.db",
    "/media/..%5cstatlin.db",
    "/media/2026/01/..%2f..%2f..%2fstatlin.db",
  ];
  for (const path of paths) {
    const { res } = await get(path);
    expect(res.status === 404, `${path} gav status ${res.status}`);
  }
});

await check("Säkerhetsrubriker", async () => {
  const { res } = await get("/");
  const csp = res.headers.get("content-security-policy") ?? "";
  for (const part of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) {
    expect(csp.includes(part), `Content-Security-Policy saknar ${part}: ${csp || "ingen rubrik"}`);
  }
  expect(/max-age=[1-9]/.test(res.headers.get("strict-transport-security") ?? ""), "Strict-Transport-Security saknas");
  expect(res.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options saknas");
  // Uppladdade filer har en egen, striktare policy i media-rutten. Sajtens policy (next.config.ts) får inte gälla där.
  const media = (await get("/media/finns/inte.webp")).res.headers.get("content-security-policy") ?? "";
  expect(!media.includes("default-src 'self'"), `/media har sajtens policy: ${media}`);
});

await check("Sitemapen och kalenderfilerna får cachas", async () => {
  const expectCached = async (path) => {
    const { res } = await get(path);
    expect(res.status === 200, `${path} gav status ${res.status}`);
    const value = res.headers.get("cache-control") ?? "";
    expect(/\bpublic\b.*\bmax-age=[1-9]/.test(value), `${path} har cache-control: ${value || "ingen rubrik"}`);
  };
  await expectCached("/sitemap.xml");
  await expectCached("/kalender.ics");
  const slug = (await get("/evenemang")).body.match(/href="\/evenemang\/([^"/]+)"/)?.[1];
  if (!slug) return "inget evenemang att prova kalenderfilen på";
  await expectCached(`/evenemang/${slug}/kalender.ics`);
});

console.log(`Snabbkontroll av ${BASE}\n`);
console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("✗")).length;
console.log(failed ? `\n${failed} kontroll(er) misslyckades.` : "\nAllt ser bra ut.");
process.exit(failed ? 1 : 0);
