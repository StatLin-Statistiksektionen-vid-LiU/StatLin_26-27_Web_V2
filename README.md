# StatLin: webbplats och adminpanel (V2)

Webbplats för **StatLin, Statistiksektionen i Linköping**, byggd efter sektionens [grafiska styrdokument](public/brand/download/grafiskt-styrdokument.pdf). Det här är V2, den nya designen: sidomeny på datorn och meny på telefonen, mörkt läge som standard och ett svagt rutnät i sidhuvudena som lyser upp kring muspekaren, där formler då och då skrivs fram för hand. Sektionens poster loggar in och lägger själva upp evenemang, nyheter och bilder, och ändrar texterna direkt på sajten.

V2 körs som en egen app på Fly.io, [statlin-web-v2.fly.dev](https://statlin-web-v2.fly.dev), från grenen `main` i det här repot. Den gamla sajten, appen `statlin-web`, körs från repot [StatLin_26-27_Web](https://github.com/StatLin-Statistiksektionen-vid-LiU/StatLin_26-27_Web) och grenen `Main-Real`, och den påverkas inte av något här. Se [Driftsättning](#driftsättning).

![Delningsbilden](public/og.png)

## Innehåll

**Publik webbplats**

- **Startsida** om sektionen. Heron har den svävande sektionsloggan med formelringen runt sig, och direkt under den kommer tidslinjen med kommande evenemang. Sektionens siffror står som en lista, och rubriken, knapparna och korten ändras i redigeringsläget.
- **Mörkt och ljust läge**: sajten öppnas i mörkt läge, och knappen i menyn byter läge med en cirkel som sprider sig från knappen. Besökarens val sparas i webbläsaren. Admin väljer under *Inställningar → Mörkt eller ljust läge* vilket läge sajten öppnas i för den som inte har valt, ett för datorn (där sidomenyn syns, från 1024 px bredd) och ett för telefonen.
- **Rutnätet och handstilen**: startsidans hero och sidhuvudena har ett svagt rutnät som lyser upp kring muspekaren. Där ljuset är skrivs då och då en formel fram för hand, i den ordning man skriver, och tonas sedan bort. Ljuset och formlerna finns också med minska rörelse. Formlerna skrivs i LaTeX och står i blocket Handskriften. I redigeringsläget finns de i en lista i sidfoten, där de läggs till, ändras, tas bort och byter ordning, och rutan för en formel visar den medan man skriver. I sajtens texter skrivs `_ord_` för hand med bläck och `_*ord*_` med rödpenna.
- **Anteckningar med pil**: korta anteckningar för hand med en pil mot ett ord på sidan. I redigeringsläget dras anteckningen dit den ska stå och pilens spets till ordet. Ett klick öppnar rutan där texten, ordet och rödpennan ändras och anteckningen tas bort, och *Ny anteckning* lägger till en på sidan man står på.
- **Sponsorer**: huvudsponsorerna står i sidomenyn på datorn och i menyn och sidfoten på telefonen, de andra i sidfoten, i den ordning SASU och admin väljer.
- **Evenemang**: listvy, månadskalender, filter per utskott, detaljsidor med bildgalleri och lightbox. Det går att lägga till ett enskilt evenemang i kalendern (iCal eller Google), och hela kalendern finns som prenumererbart flöde (`/kalender.ics`).
- **Nytt** med fästa inlägg, schemalagd publicering och avsändande utskott.
- **Sektionen**: om StatLin, styrelsen, utskott (en egen sida per utskott med deras evenemang och nytt), galleri, dokument och **grafisk profil**. Den sista är en interaktiv version av styrdokumentet med loggvarianter, färgkoder som kopieras med ett klick och nedladdningar.
- **Önskelådan** på utskottens sidor: besökare skickar önskemål till utskottet, som läser dem på utskottets sida i adminpanelen. eSTIG:s sida har ett eget tema, en Discordknapp, spelönskemål och spelet Stapla normalen.
- **Studenter** med **Kandidat**, **Master** och **Nya studenter** (med en teckning av overallen), **För företag** (med STAR) och **Kontakt**. De gamla adresserna /utbildning och /ny-student skickas vidare.
- **Länkar** (`/studenter/lankar`): de vanligaste LiU-länkarna – schema, boka rum, karta, skriva ut, tentamensanmälan och e-post, som på Tenuil – och fler i grupper. Sökningen bryr sig inte om å/ä/ö, stjärnan fäster favoriter överst (sparas i webbläsaren), och sidan visar veckonumret. Här finns också sökfältet till tentastatistiken. Genvägarna finns även på startsidan och på Kandidat, Master och Nya studenter.
- **Tentastatistik** (`/tentastatistik`): sök på kurskoden för vilken LiU-kurs som helst, med förslag medan du skriver. Kurssidan visar andel godkända de senaste tre åren, grafen *Godkända över tid*, betygsfördelningen och betygen på varje tentatillfälle, som diagram eller tabell. Statistiken kommer från samma öppna källa som liustats.se, sparas i databasen och hämtas om högst en gång per dygn. Tillfällen med färre än fem resultat visas inte.
- **Hjälpmedel** (`/studenter/hjalpmedel`): fusklappar, GitHub-länkar och guider under flikarna Kandidat och Master, sorterade på årskurs och termin med kategorin som etikett på raden. Det som gäller hela programmet ligger sist.
- **In English** (`/en` och `/en/masters`) för masterprogrammet, som ges på engelska. Texterna redigeras under *Sidor*, och knappen EN/SV i sidhuvudet växlar språk. Övriga sidor är på svenska; inget på sajten blockerar webbläsarens inbyggda översättning.
- SEO: metadata, Open Graph-bild, sitemap, robots och strukturerad data (schema.org/Event) för evenemang.
- Fungerar på mobil, med tangentbord och skärmläsare, och respekterar "minska rörelse". Utan JavaScript fungerar dokumenten, inloggningen, tentastatistikens startsida, integritetspolicyn och den grafiska profilen, och sidfoten visar kontaktuppgifter. Sidor som hämtar sitt innehåll efter att skalet visats säger i stället att de behöver JavaScript.

**Adminpanel för poster (`/admin`)**

- Inloggning per post med roller (se nedan). Efter upprepade fel lösenord från samma IP-adress får nästa försök mot kontot vänta, högst en minut, medan inloggning från andra adresser fungerar som vanligt. Misslyckade inloggningar sparas i revisionsloggen i databasen (`audit_log`, åtgärden `login_failed`) med e-postadressen men utan IP, utom de som spärren per IP stoppar. Försöken mot ett konto syns under *Senaste aktivitet* på kontots sida i *Konton*, men inte i översikten.
- **Redigeringsläge direkt på sajten**: inloggade ser en list längst ner. Med *Redigeringsläge* på ändras texter, länkar, bilder och listor där de står, och ändringarna samlas i listen med *Ångra* (Ctrl+Z), *Förhandsvisa* och *Spara* (Ctrl+S). Startsidans rubrik, knappar och kort, menyn, Vad studenterna kan, formlerna och anteckningarna har standardvärden i koden och ändras här. Det som ligger i egna tabeller, som evenemang och nyheter, har kvar pennan som öppnar formuläret i en sidopanel. *Byt bilder* på evenemang och *Byt omslag* på nyheter öppnar bara bilderna. Utskotten ser pennor bara på sitt eget innehåll. Besökare märker ingenting.
- **Utskottsvy**: utskotten och övriga poster får en egen översikt i sin färg och med sin logga, genvägar till nytt evenemang, ny nyhet och den egna sidan, och bara sitt eget innehåll. Formulären visar det viktigaste först och resten under *Fler detaljer*.
- **Evenemang** med bildgalleri. Dra in flera bilder samtidigt, så laddas de upp med förloppsindikator. Bilderna roteras automatiskt rätt, skalas om till flera storlekar och får **GPS- och EXIF-data borttagna**. Originalet sparas orört – med sin metadata – i `DATA_DIR/originals`, som inte går att nå från webben. Bildtexter, ordning (dra och släpp) och omslag ändras direkt i galleriet.
- **Bilder**: en sida med alla omslag, galleribilder och utskottsloggor. En bild sparas så fort den har laddats upp. Kontot med **grafiskt ansvar** byter bilderna på alla evenemang, nyheter och utskott men inte texterna, ser kommande evenemang som saknar omslag i sin översikt och lägger upp mallar som visas under *Mallar och material* på sidan Grafisk profil.
- **Nytt**, **sidtexter**, **styrelsen** (namn, porträtt, ordning), **utskott** (beskrivning, logga, färg), **dokument** (PDF och liknande) och **partners**.
- **Länkar**: redaktörerna sköter länksidan och väljer vilka länkar som är genvägar.
- **Hjälpmedel**: alla konton lägger upp filer och länkar per program och termin, och kan ändra och ta bort allt där. Filerna blir offentliga, och loggen visar vem som gjort vad.
- Markdown-editor med verktygsrad, förhandsvisning och bilder som dras in eller klistras in direkt i texten.
- **Konton** (endast admin). Nya konton får ett läsbart engångslösenord med fyra ord och ett tal, till exempel `kvartil-uggla-prognos-fika-4821`, som måste bytas vid första inloggningen.
- **Uppdragstavla** för styrelsen: posterna skickar uppdrag till varandra, till exempel från SASU till grafiskt ansvarig om en affisch. Uppdragen sorteras i Planerat, Pågår, Behöver hjälp och Klart och har kommentarer, deadline och koppling till evenemang. Avsändaren väljer om uppdraget syns för hela styrelsen eller bara för mottagaren. Ordförande, vice och info ser alltid allt. Uppdrag utan mottagare kan vem som helst ta, och nya uppdrag till dig syns som en siffra i menyn.
- **Granskning**: administratörerna bockar av evenemang som granskade. Nya och ändrade evenemang från utskotten och övriga poster samlas under *Att granska* i översikten. Bocken påverkar aldrig om ett evenemang visas på sajten.
- **Möten** (`/admin/moten`): ordföranden lägger in nästa möte, och alla i portalen föreslår punkter, som hamnar direkt på dagordningen före Övriga frågor. Dagordningen fylls i från dagordningsmallen och kan ändras på mötets sida.
- **Revisionslogg**: översikten visar vem som ändrade vad.

## Roller

| Roll | Typiskt för | Får göra |
| --- | --- | --- |
| **Administratör** | Ordförande, vice ordförande, informationsansvarig (webbansvarig) | Allt, inklusive konton och granskning av evenemang |
| **Redaktör** | Den som ska sköta innehållet utan att hantera konton | Allt innehåll och sajtens inställningar: evenemang, nytt, bilder, sidor, styrelse, dokument, partners, länkar, kontaktuppgifter |
| **Utskott** | Övriga poster: SCB, UBU, SASU, StatPub, STIG, eSTIG, kassör, grafiskt ansvarig … | Det egna utskottets evenemang, nytt, bilder och utskottssida. Med *Grafiskt ansvar* (under *Konton*) byter kontot också omslag, galleribilder och loggor på hela sajten och lägger upp grafiskt material under *Dokument*. |

Alla roller når uppdragstavlan och *Hjälpmedel*. Administratörer och redaktörer ser alla uppdrag, övriga ser det som delats med hela styrelsen och det som rör dem själva. Hjälpmedlen sköts gemensamt, så alla kan ändra och ta bort allt där.

Behörigheten kontrolleras på servern i varje sida, server action och uppladdning, inte bara i gränssnittet.

### Konton på sajten

Ett konto per post i styrelsen, 13 stycken, som `create-accounts` skapar (`scripts/create-accounts.mjs`). Kontot hör till posten och lämnas över varje år. Posten i kolumnen *Används av* är det som visas på uppdragstavlan. Informationsansvarig är också webbansvarig.

| Konto | Roll | Används av |
| --- | --- | --- |
| `ordforande@statlin.se` | Administratör | Ordförande |
| `vice@statlin.se` | Administratör | Vice ordförande / sekreterare |
| `info@statlin.se` | Administratör | Informationsansvarig |
| `kassor@statlin.se` | Utskott (styrelsen) | Kassör |
| `grafiskt@statlin.se` | Utskott (styrelsen) | Grafiskt ansvarig |
| `master@statlin.se` | Utskott (styrelsen) | Masteransvarig |
| `ubu@statlin.se` | Utskott (UBU) | Utbildningsbevakare |
| `sasu@statlin.se` | Utskott (SASU) | SASU |
| `scb@statlin.se` | Utskott (SCB) | Mästerichef |
| `statpub@statlin.se` | Utskott (StatPub) | Pub |
| `stig@statlin.se` | Utskott (STIG) | STIG |
| `estig@statlin.se` | Utskott (eSTIG) | e-STIG |
| `amo@statlin.se` | Utskott (AMO) | Arbetsmiljöombud |

Skriptet ger grafiskt@ *Grafiskt ansvar*. Finns det ett `webb@statlin.se` sedan tidigare lämnar skriptet det orört. Info är webbansvarig, så det kontot kan stängas av under *Konton* när info@ har tagit över.

Lösenord till sektionens konton skrivs aldrig in här eller någon annanstans i repot, eftersom alla som kan läsa repot då kan logga in. Kontona skapas med `create-accounts` (se [Fly.io](#flyio)), som visar ett engångslösenord per konto en gång. Lämna över lösenorden personligen eller via en lösenordshanterare. Varje konto måste byta lösenord vid första inloggningen, och en administratör återställer glömda lösenord under *Konton*.

## Testa i webbläsaren (utan att installera något)

Med ett GitHub-konto kan du köra hela sajten, inklusive inloggningen, i GitHub Codespaces:

1. Gå till repot på GitHub och byt till grenen du vill testa.
2. Klicka på **Code → Codespaces → Create codespace on …**.
3. Vänta några minuter medan allt installeras och byggs. Sajten öppnas sedan i en ny flik (annars: fliken **Ports** → port 3000 → klotikonen).

Demokonton i Codespaces:

| Konto | Lösenord | Roll |
| --- | --- | --- |
| `admin@statlin.se` | `lokal-admin-2026` | Administratör |
| `info@statlin.se` | `lokal-demo-2026` | Redaktör |
| `scb@statlin.se` | `lokal-demo-2026` | Utskott (SCB) |
| `ubu@statlin.se` | `lokal-demo-2026` | Utskott (UBU) |
| `grafiskt@statlin.se` | `lokal-demo-2026` | Utskott (styrelsen), grafiskt ansvar |

Logga in på `/logga-in`. Lösenorden står här i repot, så första gången du loggar in på ett konto väljer du ett eget. Codespaces är privat för ditt konto, och lösenorden gäller bara där. Stäng av eller ta bort codespacet när du är klar (*Code → Codespaces → … → Delete*) så att du inte förbrukar din gratiskvot.

## Kom igång lokalt

Kräver Node.js 20.9 eller senare.

```bash
npm install
npm run seed -- --demo   # grunddata + exempelevenemang, exempelnyheter och demokonton
npm run dev              # http://localhost:3000
```

**Bara lokalt:** `--demo` lägger in påhittade evenemang, nyheter och demokonton. Kör det aldrig mot produktionens databas. Seed vägrar när `NODE_ENV=production` eller när `SITE_URL` är satt till något annat än `localhost`/`127.0.0.1`.

**Windows utan C++-byggverktyg:** `npm install` avbryts med `gyp ERR! find VS`. npm försöker kompilera better-sqlite3 eftersom paketet har en `binding.gyp`, trots att den förbyggda binären följer med och är den som används (därför installerar `Dockerfile` python3, make och g++). Hoppa över installationsskripten och kör sedan bara de två som behövs:

```bash
npm ci --ignore-scripts
npm rebuild esbuild unrs-resolver
```

Kör inte ett vanligt `npm rebuild` efteråt – det försöker kompilera better-sqlite3 igen. Alternativt installerar du det node-gyp kräver på Windows (Visual Studio Build Tools med *Desktop development with C++* samt Python 3), så fungerar `npm install` som vanligt.

Seed-skriptet skriver ut inloggningsuppgifterna, och varje konto måste byta lösenord vid första inloggningen. Vill du välja lösenorden själv (`--demo` fortfarande bara lokalt):

```bash
ADMIN_PASSWORD=mitt-losenord DEMO_PASSWORD=demo-losenord npm run seed -- --demo
```

Seed vägrar lösenord som är kortare än 10 tecken och de kända platshållarna: `byt-mig-till-nagot-langt` ur `.env.example` och de tidigare demolösenorden `admin-statlin-2026` och `demo-statlin-2026`. Devcontainern seedar med `lokal-admin-2026` och `lokal-demo-2026`, och e2e-testets huvud anger samma seed-kommando. De lösenorden står också i repot och är bara till för lokala databaser, och kontona byter lösenord vid första inloggningen.

Utan `--demo` lägger seed in grunddatan (utskotten från styrdokumentet, styrelseposter, sidtexter och styrdokumentet som PDF) och, om databasen saknar konton, första administratören. Båda skapas av samma kod som första gången sajten startar (`src/lib/db/bootstrap.ts`), och administratören måste byta lösenord vid första inloggningen. Grunddatan läggs in en gång per tabell: en tabell som tömts, till exempel styrelsen inför ett nytt verksamhetsår, fylls inte på igen vid nästa start. Seed tar adressen ur `ADMIN_EMAIL` (annars `admin@statlin.se`) och lösenordet ur `ADMIN_PASSWORD` (annars slumpas ett, som skrivs ut). Vid första start skapas administratören bara när båda variablerna är satta.

End-to-end-testet (`npm run test:e2e`, se [Kommandon](#kommandon)) styr Chromium med Playwright. Paketet installeras med de andra, men webbläsaren laddas ner för sig, en gång per dator:

```bash
npx playwright install chromium
```

## Driftsättning

All data (SQLite-databas och uppladdade filer) ligger i en enda katalog, `DATA_DIR`. Sajten behöver därför en server med beständig disk: en VPS, Docker eller en värd med Docker och volym. V2 kör på [Fly.io](#flyio) som appen `statlin-web-v2` från grenen `main`. Hur den sköts står under [Överlämning](#överlämning), och andra värdar finns i [bilagan](#bilaga-andra-värdar) sist.

### Docker (rekommenderat)

```bash
cp .env.example .env     # fyll i SITE_URL, ADMIN_EMAIL och ADMIN_PASSWORD
docker compose up -d --build
```

Vid första start skapas grunddata och administratören från `.env`. Logga in på `/logga-in` och byt lösenord. Står platshållarlösenordet ur `.env.example` kvar, eller är lösenordet kortare än 10 tecken, skapas inget konto: hälsokontrollen `/api/health` svarar 503, och loggen visar felet (`ADMIN_PASSWORD är platshållaren …` eller `ADMIN_PASSWORD duger inte: …`) när en sida öppnas, tills ett eget lösenord är satt i `.env` och containern startats om (`docker compose up -d`). Lägg en omvänd proxy med HTTPS framför, till exempel Caddy eller nginx, på samma server: `docker-compose.yml` publicerar port 3000 bara på `127.0.0.1`, så sajten går inte att nå utifrån förbi proxyn. Låt proxyn skriva besökarens IP i en egen rubrik och ange den som `CLIENT_IP_HEADER` i `.env` – med nginx `proxy_set_header X-Real-IP $remote_addr;` och med Caddy `header_up X-Real-IP {remote_host}` i `reverse_proxy`, båda med `CLIENT_IP_HEADER=x-real-ip`. Utan den räknar inloggningsspärren alla besökare som en, och loggen varnar när containern startar (se [Miljövariabler](#miljövariabler)).

Ge ett befintligt konto ett nytt tillfälligt lösenord utan att rollen ändras, eller skapa en ny administratör med `--make-admin`:

```bash
docker compose exec -u statlin web node scripts/create-admin.mjs ordforande@statlin.se
docker compose exec -u statlin web node scripts/create-admin.mjs ny@statlin.se "Förnamn Efternamn" --make-admin
```

Utan flagga (`--reset`) får bara ett befintligt konto ett nytt lösenord, och en adress som inte finns avbryter skriptet, så att en felskriven adress aldrig blir ett nytt konto. `--make-admin` skapar kontot, eller gör ett befintligt konto till aktiv administratör (det aktiveras också om det var avstängt). Skriptet skriver ut kontots roll innan något ändras.

### Fly.io

Inställningarna finns i `fly.toml`: appen `statlin-web-v2` i region `arn` (Stockholm), en maskin med 1 GB minne och volymen `statlin_data` monterad på `/data`. Alla `fly`-kommandon i den här filen körs i repots rot och gäller då den appen. Appen skapades 2026-11-06 med en kopia av den gamla sajtens data. En ny app skapas så här:

```bash
fly apps create statlin-web-v2
fly volumes create statlin_data --region arn --size 3
fly deploy --ha=false
```

Därefter driftsätts nya versioner från grenen `main` med `fly deploy`, se [Driftsätta en ny version](#driftsätta-en-ny-version). Den gamla sajten har en egen `fly.toml` med appen `statlin-web` i sitt repo, och hur den sköts står i det repots README.

- Appen måste köra på **exakt en maskin**, eftersom SQLite-databasen ligger på volymen. Skala aldrig upp med `fly scale count`.
- Maskinen stängs av när ingen besöker sajten och startar automatiskt vid nästa besök, vilket tar några sekunder. Sätt `min_machines_running = 1` i `fly.toml` för att alltid ha den igång.
- Fly tar en ögonblicksbild av volymen varje dag och sparar den i fem dagar (`fly volumes snapshots list <volym-id>`). Hur en ögonblicksbild återställs står under [Återställning och rollback](#återställning-och-rollback). Volymen växer automatiskt upp till 10 GB, och det får bara finnas en volym som heter `statlin_data` (se [Volymen](#volymen)).
- Skapa sektionens konton, ett per post i styrelsen (13 st, se [Konton på sajten](#konton-på-sajten)), med engångslösenord: `fly ssh console -u statlin -C "node scripts/create-accounts.mjs"`. Konton som redan finns lämnas orörda.
- Återställ lösenordet för ett konto: `fly ssh console -u statlin -C "node scripts/create-admin.mjs ordforande@statlin.se"`. Rollen ändras inte, och en felskriven adress avbryter skriptet i stället för att skapa ett konto. Med `--make-admin` skapas en ny administratör, eller blir ett befintligt konto administratör.
- **Egen domän** (från `statlin-web-v2.fly.dev` till `statlin.se`), i den här ordningen:
  1. Kontrollera först att varje underdomän till statlin.se som öppnas i en webbläsare, till exempel `www.statlin.se`, svarar över HTTPS. Sajten skickar `Strict-Transport-Security` med `includeSubDomains` (`next.config.ts`): den som har besökt statlin.se får sedan bara https mot alla underdomäner i två år, och en underdomän som bara klarar http – till exempel `www` genom registratorns vidarebefordran – blir oåtkomlig för den besökaren. Ska `www` peka hit: `fly certs add www.statlin.se` och DNS-posterna som kommandot visar.
  2. Kör `fly certs add statlin.se` och lägg in DNS-posterna som kommandot visar hos domänregistratorn. Låt MX-posterna för e-posten stå kvar. Vänta tills `fly certs check statlin.se` visar att certifikatet är utfärdat.
  3. Byt `SITE_URL` till `https://statlin.se` på båda ställena i `fly.toml`, under `[build.args]` och `[env]`. Adressen bakas in i förrenderade sidor (delningsbild, `canonical`, `robots.txt`) när sajten byggs, så `fly secrets set` räcker inte – sajten måste byggas om.
  4. Lägg den här regeln först i `redirects()` i `next.config.ts`, så att den gamla adressen skickar vidare till den nya i stället för att visa samma innehåll en gång till (dubblettinnehåll för sökmotorerna). Flys hälsokontroll anropar maskinen över det privata nätet, inte `statlin-web-v2.fly.dev`, och påverkas inte.
     ```ts
     { source: "/:path*", has: [{ type: "host", value: "statlin-web-v2.fly.dev" }], destination: "https://statlin.se/:path*", permanent: true },
     ```
     Pekar `www` hit (steg 1): lägg till samma regel för den också:
     ```ts
     { source: "/:path*", has: [{ type: "host", value: "www.statlin.se" }], destination: "https://statlin.se/:path*", permanent: true },
     ```
  5. Kalenderhändelsernas UID innehåller värden (`event-<id>@<värd>`, `src/lib/ics.ts`) och byter värd samtidigt. Bestäm före bytet hur det ska hanteras för dem som prenumererar på kalendern eller har lagt in evenemang i sin egen.
  6. Kör `fly deploy` och kontrollera: `curl -sI https://statlin-web-v2.fly.dev/` ger `308` med `location: https://statlin.se`, `curl -sI https://www.statlin.se/` ger `308` med `location: https://statlin.se` (om www pekar hit), `curl -s https://statlin.se/sitemap.xml | grep -c fly.dev` ger `0`, och `node tests/smoke.mjs https://statlin.se` är grönt. Smoke jämför delningsbild, `canonical`, sitemap och `robots.txt` med adressen den provar. Byt sedan `statlin-web-v2.fly.dev` mot `statlin.se` i kommandona i den här filen.

### Utan Docker

```bash
npm ci && SITE_URL=https://statlin.se npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
HOSTNAME=127.0.0.1 DATA_DIR=/var/lib/statlin SITE_URL=https://statlin.se CLIENT_IP_HEADER=x-real-ip node .next/standalone/server.js
```

Bakom en omvänd proxy som skriver `X-Real-IP`, som under [Docker](#docker-rekommenderat). `HOSTNAME=127.0.0.1` gör att bara proxyn på samma server når sajten, som `127.0.0.1` i `docker-compose.yml` – annars lyssnar servern på alla gränssnitt, och den som når port 3000 direkt kan skriva `X-Real-IP` själv. Värdet i kommandot går före ett `HOSTNAME` som skalet redan exporterar. Utan Docker-bildens startskript varnar ingenting om `CLIENT_IP_HEADER` saknas.

### Miljövariabler

| Variabel | Beskrivning |
| --- | --- |
| `SITE_URL` | Publik adress. Används i kalenderflöde, sitemap och delningsbilder. Måste finnas redan när sajten byggs, eftersom den bakas in i förrenderade sidor: Docker-bilden tar den som byggargument (`ARG SITE_URL`), som Fly fyller i från `[build.args]` i `fly.toml` och docker compose från `.env`. Bygg om efter att du ändrat den. |
| `DATA_DIR` | Katalog för databas och uppladdningar (standard `./data`, `/data` i Docker). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Skapar första administratören om databasen saknar konton. Lösenordet måste bytas vid första inloggningen, och lösenord kortare än 10 tecken och de kända platshållarna (se [Kom igång lokalt](#kom-igång-lokalt)) vägras. |
| `COOKIE_SECURE` | Behövs normalt inte: inloggningskakan blir automatiskt `Secure` när sajten nås via HTTPS (även bakom en proxy som skickar `X-Forwarded-Proto`). Sätt `true` för att alltid kräva HTTPS. |
| `ALLOWED_ORIGINS` | Extra värdar som får skicka formulär, kommaseparerade (t.ex. `statlin.se,*.statlin.se`). Behövs bara om en proxy inte skickar vidare rätt `Host`/`X-Forwarded-Host`. I GitHub Codespaces sätts `*.app.github.dev` automatiskt. |
| `EXAM_STATS_URL` | Behövs normalt inte. Källan för tentastatistiken, standard `https://liutentor.lukasabbe.com` (samma öppna API som liustats.se). En adress som inte svarar stänger av hämtningen – då visas bara det som redan är sparat, som i e2e-testet. |
| `CLIENT_IP_HEADER` | Krävs i produktion. Rubriken med besökarens IP som värden eller proxyn framför sajten skriver och som besökaren inte kan påverka: `fly-client-ip` på Fly.io (redan satt i `fly.toml`), `x-real-ip` bakom nginx eller Caddy (se [Docker](#docker-rekommenderat)). Spärren mot upprepade inloggningsförsök och fördröjningen efter fel lösenord räknar per IP. Utan variabeln räknas alla besökare i produktionen som en – 20 försök på en kvart, från vem som helst, spärrar då inloggningen för alla resten av kvarten – och Docker-bildens startskript varnar i loggen. Ange inte `x-forwarded-for`: där kan besökaren fylla i det första värdet själv. Lokalt (`npm run dev`) används det sista värdet i `X-Forwarded-For` när variabeln saknas. |

### Säkerhetskopiering

Kopiera `DATA_DIR`. För en säker kopia av en lokal databas medan sajten kör, kör kommandot nedan i repots rot. Det använder better-sqlite3:s `backup()`, som följer med sajtens paket, och läser katalogen ur `DATA_DIR` (standard `data`). Kopian hamnar i `backups/`, som git och Docker ignorerar – repot är publikt, och en kopia innehåller lösenordshashar och sessioner:

```bash
node -e "const d=process.env.DATA_DIR||'data';require('fs').mkdirSync('backups',{recursive:true});require('better-sqlite3')(d+'/statlin.db',{fileMustExist:true}).backup('backups/statlin-'+new Date().toISOString().slice(0,10)+'.db').then(()=>console.log('Kopian ligger i backups/'))"
```

En kopia av produktionens databas kommer med ett backupskript, som väntar på beslut. Hur produktionens databas återställs ur Flys ögonblicksbilder står under [Återställning och rollback](#återställning-och-rollback).

## Överlämning

Det här behöver nästa webbansvarig (info@) veta. Gå igenom avsnittet tillsammans när posten lämnas över, och fyll i det som saknas.

### Ägarskap

Kolla vem som står på varje tjänst och på betalkortet, och flytta dem till ett konto som följer posten, med minst två personer per tjänst. Domänen ska förnyas automatiskt.

| Tjänst | Vad | Står på |
| --- | --- | --- |
| Fly.io | Appen `statlin-web-v2`: maskinen, volymen och fakturorna. Den gamla sajten, `statlin-web`, ligger på samma konto. | `<fyll i>` |
| Name.com | Domänen `statlin.se` | `<fyll i>` |
| Betalkort | Kortet som tjänsterna dras från | `<fyll i>` |
| GitHub | Repot `StatLin-Statistiksektionen-vid-LiU/StatLin_26-27_Web_V2` (publikt). Den gamla sajten ligger i `StatLin_26-27_Web`. | `<fyll i>` |

Kontona på själva sajten står under [Konton på sajten](#konton-på-sajten).

### Driftsätta en ny version

Sajten driftsätts för hand från en dator där `fly` är inloggat på Fly-kontot. `fly deploy` skickar med allt i arbetskatalogen, också ändringar som inte är committade, så arbetsträdet ska vara rent och stå på `main`. Ta en ögonblicksbild av volymen först, så att databasen går att återställa till läget före versionen om den har ett nytt steg i `src/lib/db/migrations.ts`:

```bash
git status                                            # "On branch main" och "nothing to commit, working tree clean"
fly volumes list                                      # volymens id (vol_…)
fly volumes snapshots create <vol-id>                 # sparar läget före den nya versionen
fly deploy --image-label v2-$(git rev-parse --short HEAD)
node tests/smoke.mjs https://statlin-web-v2.fly.dev   # läser bara, säker mot produktionen
```

Etiketten ger imagen commitens namn, till exempel `registry.fly.io/statlin-web-v2:v2-ff16dc0`, så att `fly releases --image` visar vilken commit varje version kör. Ett deploy-skript är planerat.

### Återställning och rollback

Fly tar en ögonblicksbild av volymen varje dag och sparar den i fem dagar. En ögonblicksbild återställs alltid till en ny volym, som en ny maskin får. Skriv aldrig över databasen med `fly ssh sftp put` medan sajten kör.

**Rulla tillbaka koden.** Om den nya versionen inte ändrade databasen räcker det att driftsätta den förra imagen igen:

```bash
fly releases --image          # versionerna med sina images – välj den senaste som fungerade
fly deploy --image <image>    # ur kolumnen Docker Image, t.ex. registry.fly.io/statlin-web-v2:v2-ea7c367
```

Har den nya versionen ett nytt steg i `src/lib/db/migrations.ts` har den migrerat databasen, och då räcker det inte. Den äldre koden vägrar använda en nyare databas: hälsokontrollen svarar 503, `fly deploy` väntar förgäves på den, och `fly logs` visar `databasen är nyare än koden` när någon öppnar en sida. Databasen återställs därför först till en ögonblicksbild från före driftsättningen, och `fly deploy --image` med den förra imagen kommer sist, enligt nästa stycke.

**Återställ databasen**, också när data har försvunnit eller blivit fel. `<image>` är imagen som ska köras efteråt: den nuvarande om bara datan återställs, den förra (ur `fly releases --image`) vid en rollback.

```bash
fly volumes list                              # den levande volymens id (vol_…) och maskinen under ATTACHED VM
fly volumes snapshots list <vol-id>           # välj en ögonblicksbild (vs_…) från före felet och notera VOL SIZE
fly volumes snapshots create <vol-id>         # spara läget just nu, så att inget går förlorat
fly volumes create statlin_data --snapshot-id <vs-id> --region arn --size 3   # minst VOL SIZE; ger en ny vol_…
fly machine stop <maskin-id>                  # stoppar den gamla maskinen; kör härifrån till destroy i ett svep
fly machine update <maskin-id> --image <image> --skip-start                    # ger maskinen imagen utan att starta den
fly machine list                              # den gamla maskinen ska stå som stopped
fly machine clone <maskin-id> --attach-volume <ny-vol-id>:/data                # en ny maskin på den återställda volymen
fly machine destroy <maskin-id> --force       # den gamla maskinen; dess volym ligger kvar okopplad
fly deploy --image <image>                    # återställningen blir en release med inställningarna i fly.toml
```

- Kör stegen från `fly machine stop` till `fly machine destroy` direkt efter varandra. Den gamla maskinen har kvar sina tjänster, och med `auto_start_machines = true` i `fly.toml` kan en begäran väcka den igen ända tills den är borttagen. Det som sparas på sajten under de minuterna hamnar på den gamla volymen och kommer inte med. Står maskinen inte som `stopped` i `fly machine list`, stoppa den igen innan du klonar.
- `fly machine update` visar ändringarna och frågar `Apply changes?` – svara y. Är imagen redan densamma, som när bara datan återställs, avbryter kommandot med felet `no config changes found`. Gå då bara vidare.
- Klonen får imagen från maskinen den klonas från. Därför byts imagen innan maskinen klonas: kod som är nyare än ögonblicksbilden får aldrig öppna den återställda databasen, för då migrerar den den igen.
- Den nya volymen måste heta `statlin_data`, annars byter `fly deploy` ut maskinen.
- `fly volumes create` lägger som standard volymen i en annan hårdvaruzon än volymerna med samma namn (`--require-unique-zone`). Saknas en ledig zon, lägg till `--require-unique-zone=false`.
- Kontrollera sedan sajten med `node tests/smoke.mjs https://statlin-web-v2.fly.dev`, logga in och se att det senaste innehållet finns. `fly volumes list` ska visa den nya volymen som kopplad.
- När allt fungerar tar du bort den gamla volymen med `fly volumes destroy <gamla-vol-id>`, så att bara en `statlin_data` finns kvar, och skriver in den nya volymens id under [Volymen](#volymen). Kommandot varnar att det inte går att ångra och frågar `Are you sure you want to destroy this volume?` – svara y.

**Öva** återställningen en gång om året, i juni (se [Årshjul](#årshjul)), så att den inte prövas första gången under press. Övningen görs mot en testvolym med ett eget namn, som `fly deploy` aldrig monterar, och en maskin utan `--port`, som inte får någon publik trafik:

```bash
fly volumes create statlin_ovning --snapshot-id <vs-id> --region arn --size 3   # varnar och frågar, se nedan
fly machine run <image> --volume <test-vol-id>:/data --region arn
fly ssh console --machine <test-maskin-id>
#   i skalet: node -e "fetch('http://127.0.0.1:3000/api/health').then(r => r.text()).then(console.log)"
fly machine destroy <test-maskin-id> --force
fly volumes destroy <test-vol-id>             # frågar Are you sure you want to destroy this volume? – svara y
```

En volym med ett namn som ingen annan volym har ger varningen `Every volume is pinned to a specific physical host…` och frågan `Do you still want to use the volumes feature?` – svara y, eller lägg till `--yes`. Hälsokontrollen ska svara `{"ok":true}`. Senast övad: `<fyll i datum>` (ingen övning är gjord än).

### En process och en maskin

Hela sajten är en Node-process på en enda Fly-maskin, med SQLite-databasen på maskinens volym.

- Skala aldrig upp med `fly scale count` eller fler processer: en ny maskin får en egen volym och därmed en egen databas.
- Det som bara finns i processens minne nollas varje gång maskinen startar, och maskinen stängs av när ingen besöker sajten (`auto_stop_machines` i `fly.toml`). Det gäller spärren mot upprepade inloggningsförsök per IP och fördröjningen efter fel lösenord per konto och IP (båda i `src/lib/auth/rate-limit.ts`) och `inflight`-kartan som samlar samtidiga hämtningar av tentastatistik (`src/lib/data/exam-stats.ts`). Ingen inloggningsspärr ligger i databasen. Där finns revisionsloggens rader om misslyckade inloggningar och räknaren `failed_logins` per konto (bara statistik, ingen spärr).

### Volymen

Databasen och uppladdningarna ligger på volymen `statlin_data` i `arn`. Fly väljer volym efter namnet i `fly.toml` (`source = "statlin_data"`), inte efter id. Finns det två volymer med samma namn kan en ny maskin – efter `fly machine destroy`, `fly scale count` eller en flytt – få fel volym: sajten startar då som ny med bara grunddata, och nya ändringar hamnar på fel volym.

Läget 2026-11-07 enligt `fly volumes list`:

| Volym | Läge |
| --- | --- |
| `vol_v3g858nl3d0zwdl4` | Kopplad till maskinen `830d1db7199428`, den levande volymen. Skapad 2026-11-06 med en kopia av den gamla sajtens data. |

Fly byter volymens id om maskinen flyttas till en annan värd, som när den gamla sajtens maskin flyttades 2026-11-06 (`migrated=true` i `fly machine status`). Bekräfta därför läget med `fly volumes list` (kolumnen ATTACHED VM) och rätta tabellen. Ögonblicksbilderna från före en flytt ligger kvar under det gamla id:t. Finns det en okopplad volym med samma namn avgör du själv om den ska tas bort med `fly volumes destroy <id>`. Det går inte att ångra, så kontrollera först att den är tom eller gammal, med en maskin utan publik trafik som i övningen ovan. CREATED AT säger inget efter en flytt.

### STAR-sidan och lunchföreläsningarna

`/star` är arbetsmarknadsdagens egen sida, och `/lunchforelasningar` har nästa föreläsning och studenternas önskelista. SASU:s konto och redaktörer sköter båda i adminpanelen.

- **Företag:** `/admin/star`. Varje företag blir ett kort och en stjärna på kartan. Rollen avgör om det också står under Sponsorer. Utan företag står det att de presenteras snart.
- **Datum, plats och program:** tas från STAR-evenemanget, det som ligger närmast av de med adressen `star` eller `star-2027`. Programmet är rader under rubriken `## Program` i evenemangets text, till exempel `- **10.00** Mässan öppnar`.
- **Önskemål:** `/admin/lunchonskemal`. Nya önskemål syns först när någon har godkänt dem, och menyn visar hur många som väntar. När ett önskemål blir av: sätt status och koppla evenemanget.
- **Vilka föreläsningar som visas:** kommande evenemang vars titel börjar med "Lunchföreläsning" eller vars adress börjar med `lunch`.

Innan det går live: låt SASU läsa de tre raderna i bandet "Vill ni hålla en lunchföreläsning?" och texterna till företagen, och lägg in de företag som redan är klara. Allt annat följer med migrationen när en ny version startar. Påhittat innehåll att prova med finns i `scripts/demo-naringsliv.ts`, som vägrar köra i produktion.

### Årshjul

| När | Vad |
| --- | --- |
| Vid överlämningen | Gå igenom det här avsnittet, fyll i [Ägarskap](#ägarskap) och kontrollera [Volymen](#volymen). |
| Juni | Större uppgraderingar (Next.js, Node, beroenden) och den årliga övningen i [återställning](#återställning-och-rollback). |

### Årshjulet och projektplanerna i adminpanelen

Under *Årshjul* och *Projektplaner* i adminpanelen samlas det som kommer tillbaka varje år, så att nästa års post slipper börja från noll. Alla poster läser och lägger till. Den som la in något, den ansvariga posten och admin ändrar. Hjulet börjar om av sig självt varje år: läget (planerad, klar, hoppas över) sparas per år, och själva punkterna står kvar. På hösten visas också vårens punkter, hjulet kan visa bara SCB:s punkter, och punkter som borde ha varit klara markeras som försenade.

Före live: inget behöver installeras eller ställas in, och migreringen körs vid start som vanligt. Tryck sedan en gång på *Fyll med förslag* och gå igenom hjulet tillsammans. Månaderna är en gissning, och ansvarig måste skrivas som postens eller utskottets namn för att uppdragen ska hamna rätt. Exempeldata för lokal provning finns i `scripts/demo-postverktyg.ts`. Mallarna för projektplaner är konstanter i `src/lib/projektplan-mallar.ts`.

### Frågelådan

Frågelådan låter besökare ställa en anonym fråga utan att logga in. En post skapar en låda under **Frågelådan** i adminpanelen och visar sexteckenskoden, till exempel i en föreläsningssal med **Visa på skärm**. Besökaren skriver koden på `/fragelada` och lämnar sin fråga. UBU och AMO har fasta lådor utan kod, `/fragelada/ubu` och `/fragelada/amo`. Bara kontot som äger en låda kan läsa frågorna. Administratörer ser titlar och antal och kan ta bort lådor med kod, men kan inte läsa frågorna i adminpanelen. Lådan är envägs: det går inte att svara.

Frågorna sparas med månad, inte med namn, IP-adress eller klockslag, och raderas efter ungefär ett år. Det gäller det sajten själv sparar. Fly-snapshots behåller raderade frågor i upp till fem dygn, och den som kommer åt servern kan läsa databasen.

Funktionen är avstängd tills en administratör slår på den under **Frågelådan**. Före det:

1. Bekräfta vem som är AMO och att UBU och AMO läser sina lådor (U-04). En fast låda utan aktiv ägare tar inte emot frågor. När funktionen slås på får lådorna kontona `ubu@statlin.se` och `amo@statlin.se` om de finns, annars väljer administratören ägare.
2. Ändra texterna i produktionsdatabasen så att de stämmer: seed-texterna gäller bara nya databaser. Listan finns i rapporten för frågelådan.
3. Besluta om säkerhetskopiorna (B-16), om vad som loggas på vägen till servern (B-17) och om B-18.

Att prova lokalt: `DATA_DIR=<samma som servern> npx tsx scripts/demo-fragelada.ts` slår på funktionen och skapar en påhittad låda med koden `STAT26`. Skriptet vägrar köra i produktion.

## Guide för poster

1. Logga in på **/logga-in** med postens e-postadress.
2. **Nytt evenemang**: översikten har stora knappar för det vanligaste. Fyll i titel, tid, plats och en kort sammanfattning (eller en beskrivning) och välj **Publicera** – eller **Spara som utkast**, som också är vad Enter i ett fält gör för ett nytt evenemang. Sluttid, kartlänk, anmälan och pris finns under *Fler detaljer*. Utan omslagsbild genereras ett omslag i utskottets färger med utskottets logga.
3. **Efter evenemanget**: öppna det under *Evenemang*, scrolla till *Bildgalleri* och dra in bilderna. De dyker upp direkt på sajten och i galleriet. Klicka på ★ för att välja omslag.
4. **Nytt** publiceras direkt när inlägget har en ingress eller en text, eller vid en viss tid om du anger ett framtida datum.
5. **Uppdragstavlan**: *Nytt uppdrag* skickar ett uppdrag till en annan post, eller lägger upp det öppet så att vem som helst kan ta det. Mottagaren flyttar det mellan Planerat, Pågår, Behöver hjälp och Klart, och båda kan skriva kommentarer, till exempel med en länk till utkastet i Canva.
6. **Länkar**: under *Länkar* (redaktörer) styrs länksidan – slå på *Genväg* för att länken ska visas överst och på startsidan. Tentastatistiken behöver ingen skötsel: den hämtas automatiskt när någon söker på en kurskod.
7. **Hjälpmedel**: under *Hjälpmedel* lägger du upp en fil eller en länk och väljer program, termin och kategori. Gäller det flera terminer väljer du *Hela programmet*. Allt blir offentligt, så lägg bara upp sådant ni får dela.
8. **Bilder (grafiskt ansvarig)**: under *Bilder* finns omslagen till alla evenemang och nytt och utskottens loggor – ladda upp en bild så är den sparad. *Galleri* på ett evenemang leder till dess bildgalleri. Översikten visar kommande evenemang som saknar omslag, och ett uppdrag som är kopplat till ett evenemang har knappen *Ladda upp omslag*. Mallar läggs upp under *Dokument* och visas under *Mallar och material* på sidan Grafisk profil.
9. **Ändra direkt på sajten**: gå till sidan du vill ändra medan du är inloggad och slå på *Redigeringsläge* i listen längst ner. Valet sparas i webbläsaren. Klicka på texten, länken eller bilden, ändra den där den står och tryck *Spara* i listen. Evenemang och nyheter har en röd penna som öppnar formuläret. På evenemang och nyheter byter *Byt bilder* och *Byt omslag* bilderna direkt i sidopanelen. Partners ändras i adminpanelen, och panelen har en länk dit.
10. **Årshjul och projektplaner**: översikten visar vad som väntar nästa månad och vad som behöver planeras in denna termin. Lägg en punkt på tavlan, eller gör en projektplan av den: välj mall och datum, så räknas stegen ut bakåt. Stegen stannar i planen tills du skickar dem till uppdragstavlan, ett i taget eller alla på en gång. Skriv lärdomar på planen efteråt, så ser nästa års post dem när de gör om samma sak.

Översikten visar evenemang som har varit men saknar bilder och uppdrag till dig. Administratörerna ser också *Att granska*: evenemang som övriga poster har skapat eller ändrat sedan de senast granskades.

## Teknik

- **Next.js 16** (App Router, Cache Components, Partial Prerendering, server actions) och **React 19**.
- **SQLite** via `better-sqlite3`, med versionerade migreringar i `src/lib/db/migrations.ts`.
- **sharp** för bildbehandling (WebP i 480/1200/2000 px, rotering efter EXIF, metadata borttagen; originalet sparas i `DATA_DIR/originals`).
- **Tailwind CSS 4** med egna designtokens (`src/app/globals.css`). Tailwind körs genom Turbopack-laddaren `@tailwindcss/turbopack` (`turbopack.rules` i `next.config.ts`). Lägg ingen `postcss.config` bredvid, för då körs Tailwind två gånger. Laddaren och `tailwindcss` är låsta till samma exakta version, så uppdatera dem tillsammans. Kör sedan `npm run build` och kontrollera att en ny klass finns i `.next/static/**/*.css`. Töm `.next/cache` om CSS:en ser gammal ut.
- Sessioner i databasen (slumpad token, endast SHA-256-hashen lagras), lösenord med bcrypt, CSRF-skydd via SameSite-cookies och kontroll av ursprung.
- Typsnitt (Archivo, JetBrains Mono och handstilen Mynerve) är självhostade via Fontsource, så inga externa anrop görs. Mynerve laddas först när handskriven text närmar sig skärmen. Citat sätts i systemtypsnittet Georgia, och formelringen runt loggan har ett eget typsnitt, eftersom Georgia saknar hatten över β.
- Formlerna i rutnätet skrivs i LaTeX. En egen liten tolk (`src/lib/latex.ts`) och en sättare (`src/components/content/formel.ts`) lägger ut dem i Mynerve: bråk, rötter, summor och integraler med gränser, index och exponenter, accenter, matriser, `cases` och parenteser som växer. Tecken som Mynerve saknar ritas som streck (`formel-tecken.ts`). Tolken och typsnittet laddas först när pekaren har rört sig. Planen finns i `docs/plan-formler-anteckningar.md`.
- Läget sajten öppnas i: skalet är förrenderat och kan inte läsa databasen, så `src/proxy.ts` lägger Admins val i kakan `statlin-tema-standard` när en hel sida hämtas, och skriptet i `<head>` (`src/app/layout.tsx`) läser kakan innan något ritas. Mörkt på båda ger ingen kaka, och besökarens eget val i `localStorage` går före. Se `src/lib/tema.ts`.

```
src/
  app/(site)/        publika sidor
  app/admin/         adminpanelen (+ _actions/ med server actions)
  app/api/           uppladdning, hälsokontroll och kurskoder till tentastatistiken
  app/media/         serverar uppladdade filer från DATA_DIR
  components/        UI (bland annat admin/, brand/, content/, edit-mode/, home/, layout/)
  lib/               databas, auth, data, innehållsblocken, markdown, LaTeX, media, datum (Europe/Stockholm), iCal
  proxy.ts           inloggningen till adminsidorna, tentastatistikens adresser och kakan med standardläget
scripts/             seed, create-admin, create-accounts, docker-entrypoint (startskriptet i Docker-bilden) och lib.mjs,
                     som create-admin och create-accounts delar, med ordlistan för engångslösenord (password-words.json)
public/brand/        loggor (SVG-varianter, utskottsloggor, nedladdningar)
docs/                planerna för önskemålen och för formlerna och anteckningarna, och åtgärdsplanen
```

### Loggan

Sektionsloggan är vektoriserad från originalet i styrdokumentet. Ringen är en ren cirkel, medan texten, rutnätet och den röda signaturen är spårade banor. Lagren ligger var för sig i `src/lib/brand/logo-paths.ts`. Det gör att varianterna från styrdokumentet (standard, inverterad, svart, vit, röd) genereras exakt, och att heron kan animera lagren utan att formen ändras. Slutläget är alltid den oförändrade loggan.

Sajten visar den officiella loggan. På svart bakgrund smälter den svarta ringen ihop med bakgrunden, så loggan får en tunn vit kant: klassen `logo-kant` på bilder och en tunn cirkel i `FloatingLogo` och på overallens rygg. Den inverterade formen finns bara som nedladdning under Grafisk profil.

Startsidans hero har också en formelring (`src/components/brand/formula-ring.tsx`). Formlerna ligger i ett eget lager utanför loggan, så loggan ritas aldrig om. De kommer fram runt loggan när musen är nära, och på telefon när man trycker på loggan. Admin stänger av ringen under *Inställningar* (*Formelringen runt loggan*) eller med knappen vid loggan i redigeringsläget, och då visas bara loggan. Valet läses bakom en egen `Suspense`, så loggan ligger kvar i det statiska skalet och syns direkt i båda fallen.

På telefoner och surfplattor, där `(pointer: coarse)` gäller, är sajten lättare. Kornet över de mörka och röda ytorna är borta, eftersom blandningsläget kostar ett eget ritpass, knapparna är 44 px höga och textlänkarna går att träffa med fingret. Tills Archivo har kommit används Arial eller Roboto, skalade till samma bredd, så att rubriken bryts likadant och heron inte hoppar. De nedersta sektionerna på startsidan har klassen `below-fold`: på en smal telefonskärm får de `content-visibility: auto` och läggs inte ut förrän de närmar sig skärmen.

## Kommandon

| Kommando | Gör |
| --- | --- |
| `npm run dev` | Utvecklingsserver |
| `npm run build` / `npm start` | Produktionsbygge / kör bygget |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run test:datum` | Enhetstester utan server eller databas (`tests/datum.test.mjs`): datumhanteringen, formulärdelarna i adminpanelen och länkhjälparen |
| `npm run seed [-- --demo]` | Grunddata och första administratören; med `--demo` även demodata och demokonton – bara lokalt, vägras i produktion |
| `npm run create-admin -- <e-post> ["Namn"] [--reset \| --make-admin]` | Nytt lösenord för ett befintligt konto med rollen orörd (`--reset`, standard – en felskriven adress avbryter i stället för att skapa ett konto); `--make-admin` skapar en administratör eller gör kontot till administratör |
| `npm run create-accounts` | Skapa ett konto per post i styrelsen (13 st, se [Konton på sajten](#konton-på-sajten)); hoppar över befintliga |
| `npm run test:e2e [-- <url>]` | End-to-end-test (inloggning, roller, evenemang, bildgalleri, granskning, uppdragstavla, länksidan, tentastatistik, hjälpmedel, grafiskt ansvar, nyheter, Markdown-rensning och kontoskydden) mot en nyseedad server, som standard `http://localhost:3000` – se kommentaren i `tests/e2e.mjs`. Nya steg läggs som en egen fil i `tests/e2e-steg/`. Mot `npm start` krävs `CLIENT_IP_HEADER=x-forwarded-for`, eftersom kontostegen loggar in från egna IP-adresser. Kräver `npx playwright install chromium` en gång per dator. |
| `node tests/smoke.mjs <url>` | Snabbkontroll av en körande sajt: sidor, hälsokontroll, kalenderflöde, sitemap, att uppladdningen nekar andra ursprung, att mediaadresser inte leder ut ur uppladdningsmappen, och att delningsbild, `canonical`, sitemap och `robots.txt` pekar på `SITE_URL` (miljövariabeln, annars `<url>`). Ändrar ingenting, så den är säker att köra mot produktion. Kräver bara Node. |
| `npm audit --omit=dev` | Sårbarheter i det som körs i produktion. Det är sajtens mått och ska ge 0. `npm audit` utan flaggan räknar också utvecklingsverktygen. Där lyfter `overrides` i `package.json` `minimatch` till version 11, eftersom ESLints kedja annars ger 16 varningar. Lint fungerar så länge ingen regel anropar `minimatch` som en funktion, vilket inga av de regler vi har på gör. Slår någon på en sådan regel, till exempel `react/no-danger` med `customComponentNames`, kraschar lint med `minimatch is not a function`. Ta bort overriden när ESLint-paketen själva kräver version 11. Kör aldrig `npm audit fix --force`: den vill byta `eslint-config-next` mot version 0.2.4. |

## Att göra

- E-post för "glömt lösenord" (i dag återställer en administratör lösenordet).
- Hela sajten på engelska under samma `/en/...`-adresser (i dag finns `/en` och `/en/masters`), gärna med automatisk översättning när en post sparar en text.
- Anmälningar direkt på sajten i stället för externa formulär.

Exempelinnehållet (evenemang, nytt, styrelsenamn, e-postadresser på `@statlin.se` och exempelbilder i galleriet) är platshållare. Byt ut det i adminpanelen innan sajten publiceras.

## Bilaga: Andra värdar

V2 kör på Fly.io. Det här behövs om sajten flyttas till en annan värd med Docker och volym, till exempel Railway:

1. Skapa ett projekt från GitHub-repot (gren `main`). Dockerfilen används automatiskt, och varje merge till `main` driftsätts.
2. Lägg till en volym med monteringssökvägen `/data`. Utan den försvinner databasen och alla uppladdningar vid nästa driftsättning. Railway monterar volymen som root, vilket startskriptet `scripts/docker-entrypoint.mjs` rättar, och tillåter inte `VOLUME` i Dockerfile – lägg därför inte till någon.
3. Sätt variablerna `ADMIN_EMAIL`, `ADMIN_PASSWORD` och `SITE_URL`. Railway skickar tjänstens variabler som byggargument när Dockerfile deklarerar dem, och `SITE_URL` behövs vid bygget (`ARG SITE_URL`).
4. Spärren mot upprepade inloggningsförsök behöver Railways rubrik med besökarens IP: sätt `CLIENT_IP_HEADER=x-real-ip` (på Fly.io är det `fly-client-ip`, som redan står i `fly.toml`).
5. Slå på schemalagda säkerhetskopior av volymen och, om värden har det, hälsokontroll på `/api/health`.
6. Kontrollera driftsättningen med `node tests/smoke.mjs https://din-adress`.
