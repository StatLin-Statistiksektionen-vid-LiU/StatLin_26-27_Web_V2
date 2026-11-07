# Önskemålen 2026-11-06 (ny-design)

**Status 2026-11-07:** punkt 1 till 11 är klara, och handstilen i rutnätet och anteckningarna har tillkommit (se "Handstil, anteckningar och formler"). Allt är provat lokalt, och hela e2e-sviten gick igenom (234 av 234) både före och efter handstilen, se "Provningen 2026-11-07" nedan. Användaren sa ja till utläggningen, så allt är committat på ny-design för statlin-web-v2.

Klart lokalt sedan tidigare, men inte live:
- Menylänkarna till `#kompetens` och `#lunchforelasning` hamnar rätt från alla sidor.
- Mörkt läge är standard.

## Redigering först

1. **Nytt redigeringsläge, helt omgjort.** Allt som syns på sajten ska gå att ändra, enklare och smidigare än i dag.
   - **Direkt på sidan:** man klickar på en text, länk eller bild och ändrar den där den står, i stället för i en sidopanel med formulär.
   - **Listor på sidan:** man kan lägga till, ta bort och dra för att byta ordning. Det gäller färdigheter, menyn, knappar och kort.
   - **Samlad list längst ner:** sidans ändringar samlas där, med Spara, Ångra och Förhandsvisa. Inget syns för besökare förrän man sparar.
   - **Innehållet på ett ställe:** varje del av sajten har sitt innehåll samlat, med standardvärden i koden. Då blir nya delar redigerbara utan ett eget formulär.
   - **Behörigheter:** desamma som i dag, och servern kontrollerar alltid.
   - **Admin:** finns kvar för det som inte syns på sidorna, som konton och inställningar.

   Punkterna 2, 3 och 4 byggs i det nya läget.

   Bestämt med användaren: utkasten syns bara för den som redigerar, och en sparad ändring syns direkt för alla.
2. **Vad studenterna kan.** Innehållet i `src/lib/foretag-kompetens.ts` blir standardvärden. Följande går att ändra:
   - texterna
   - de fyra nivåerna
   - programmen med nyckelord
   - färdigheterna per grupp, med läget på varje nivå
   - guldkornen
   - branscherna

   Rader kan läggas till, tas bort och flyttas. `/foretag`, STAR-inbjudan och sökningen läser samma data.
3. **Menyn.** Varje grupp och länk får etikett, beskrivning, ordning och möjlighet att döljas. `NAV` i `src/lib/navigation.ts` blir standard. Sidhuvudet, telefonmenyn och sidfoten läser samma lista.
4. **Startsidan.** Följande går att ändra, både text och länk:
   - knapparna i heron (tom text döljer knappen)
   - de två knapparna under Om
   - de två korten längst ner

   Genvägarna går redan att ändra i Admin > Länkar.

   Korten: texterna ändras där de står (RText), och ett klick på kortet öppnar en ruta för länken. STAR-kortet har två länkar, en för när STAR är live.

## Design

5. **Sidfoten.** Normalfördelningen tas bort (2). Sponsorerna står i en smal vit list med loggorna, i stället för en ruta per sponsor (3).
6. **Startsidan:**
   - Heron och 01 Om blir samma del (4, 5).
   - Siffrorna blir en lista (1).
   - Kalendern kommer direkt efter heron (9).
   - Alla delar får mycket mindre luft (10).
7. **Små lagningar:**
   - Nivåväljaren blir lägre (6).
   - Nya färdigheter får en liten röd punkt i stället för en röd ring, och förklaringen likaså (8).
   - Nyhetsartiklarna får mindre luft (12).
8. **Autobilder och UBU:**
   - Autobilderna för nyheter får ett statistiskt motiv som väljs efter nyhetens namn och fungerar i båda lägena (13).
   - UBU får en knapp till kursutvärderingen, med en länk som går att ändra (15). Meningen i önskemålet tog slut, så fråga var det andra stället är.

## Kreativt

9. **Rutnät och handskrift (11):**
   - Rutnätet lyser upp där muspekaren är, på hela sidan. Det gäller bara med mus, och sedan 2026-11-07 också med reducerad rörelse. Tekniken är ett lager med radial mask, där läget sätts som CSS-variabel i requestAnimationFrame.
   - Handskrivna ekvationer, citat och bilder ritas fram med stroke-dasharray och går att ändra.
10. **eSTIG-sidan (14):**
    - spel- och filmtema i eSTIG:s färger
    - Discordknapp
    - spelönskemål (som lunchönskemålen)
    - ett litet spel som laddas först när man klickar på loggan och inte kostar sidan något

## Sist

11. **Provning:**
    - STAR-sidan efter heron
    - fem storlekar i båda motorerna
    - ankarproven
    - hela e2e-sviten, körd ensam
12. **Utläggning efter ja.** Commit på ny-design, push till V2-repots main, ren export med `git archive`, och sedan bygg och utläggning på statlin-web-v2.

## Så blev punkterna 8 till 10

- **UBU:** knappen till kursutvärderingarna står både på UBU:s utskottssida och på UBU-kortet. Länken ligger i blocket `ubu`, och flaggan `ubu` i `far()` och adminlisten styr vem som får ändra den.
- **Rutnätet:** ljuset under musen ligger i `src/components/layout/rutnat-ljus.tsx`. Det är av utan mus men lyser också med reducerad rörelse, då utan att tonas in och ut. Sidhuvudenas rutnät är millimeterpapper.
- **Handskriften:** `src/components/content/handskrift.tsx` och blocket `handskrift`, med typsnittet Mynerve. Anteckningen vid loggan syns från 1280 px, och sidfoten visar ett slumpat citat. Ringen runt namnet går ut lika långt oavsett namnets längd, så att den ryms på telefoner från 320 px.
- **eSTIG:**
  - Temat byter sidans röda mot eSTIG:s blå (`.estig-tema` i `globals.css`). Sidhuvudet har tända pixlar i rutnätet och loggan i en kamerasökare, och en filmremsa står under det.
  - Loggan startar spelet Stapla normalen (`src/components/estig/spelet.tsx`). Spelet är eget: man fyller nio staplar upp till en normalfördelning, och ett block över strecket är ett extremvärde som kostar ett liv. Koden hämtas först när musen är över loggan eller när någon trycker, och rekordet sparas i webbläsaren.
  - Discordknappen syns för besökare när den har både text och länk. Länken saknas än och läggs in i redigeringsläget.
  - Spelönskemålen går till eSTIG:s önskelåda. Migreringssteg 19 och seeden slår på den för eSTIG, och utskottet kan stänga den i Admin.

## Handstil, anteckningar och formler

- **Formlerna i rutnätet:** `RutnatLjus` skriver då och då en statistisk formel för hand där pekaren lyser, mitt i den tomma ytan mellan innehållet. Den syns bara i ljuset (en mask kring pekaren, `.rutnat-formel`), står kvar i sju sekunder och tonas sedan bort. Högst två åt gången, var tredje med rödpenna. Ytan mäts med `elementFromPoint`: text, länkar, kort med egen bakgrund, hårlinjer och fönstrets kanter räknas som innehåll.
- **Anteckningarna:** `Anteckning` i `src/components/content/anteckning.tsx` skriver en kort anteckning med en pil till ett ord i rubriken. Den provar några platser kring ordet och hamnar där den inte täcker något, och får den inte plats syns den inte. Texterna är inställningar (`text_<grupp>_anteckning` och `text_om_anteckning`): en tom ruta ger standardtexten, ett `-` tar bort anteckningen och `*text*` gör den röd.
  - Om StatLin: "(topp 5 sektion)" ovanför rubriken, med pilen till StatLin. Den ändras där den står i redigeringsläget.
  - Nytt, Galleri (röd), Dokument och Styrelsen: vid slutet av rubriken. De ändras med pennan för sidhuvudet.
- **Bläck och rödpenna:** handstilen skrivs med bläck, svart i ljust läge och vitt i mörkt (`--color-ink`). `_ord_` ger bläck och `_*ord*_` rödpenna, i rubriker, ingresser och texterna på startsidan. Migreringssteg 20 gör "ingen erfarenhet krävs." i rutan Engagera dig röd.
- **Sidhuvudenas rutnät:** `PageHero` har ett svagt rutnät (`.sidhuvud-rutnat`) som tonas ut mot kanterna, som runt loggan på startsidan.
- **Mörkt läge** är standard. Den som har valt ljust läge behåller det.

## Provningen 2026-11-07

Lagat under provningen:
- **Meddelandet på startsidan** lades över heron på telefoner där heron är högre än skärmen. `AnnouncementPill` bevakar nu hela heron (`data-hero-yta`) och visar meddelandet först när heron inte längre når ner i skärmens nedersta 12 %.
- **Korta rubriker på en rad:** `fitHeading` har fått `enRad`. En rubrik med flera ord som är högst 15 % för lång för raden krymper så att den står på en rad, som mest ungefär 13 % mindre. Förut kunde den brytas med Archivo men inte med reservfonten, och då hoppade sidan när typsnittet kom ("Ny student" på telefon). `PageHero` använder det. Synligt: till exempel "Grafisk profil" står nu på en rad på 600 till 768 px.
- **STAR-himlen** stack ut över sidfoten när man scrollat till slutet, och på telefonen slutade den med en skarp kant mitt i sidfoten. `.star-sida` klipper nu det som sticker ut (`overflow: clip`). Felet finns även i d0073a4 som är live.

Prov som ändrades, för att sidan ändrats och inte för att dölja fel:
- `evenemang.mjs` (SB-08): siffrorna i heron är en lista med talet först, och talet räknas upp, så raden väntas in tills det står rätt.
- `meddelande.mjs`: de framhävda orden är `.text-ink`, och steget för meddelandet scrollar räknat från herons nederkant.
- `metadata.mjs`: mörkt läge är standard, så texten är rgb(236, 235, 230).
- `naringsliv.mjs`: kalendern kommer direkt efter heron och före genvägarna. Kontrollen att STAR inte hämtar något utifrån jämför värdnamn.
- `moten.mjs`: adressen byts innan sidan kommit, så dagordningen väntas in.
- `tavlan.mjs`: markeringen "Behöver hjälp", inte valet med samma text i statuslistan.
- `e2e.mjs`: rutnätets ljus (pekarens läge som CSS-variabler, följer med över sidomenyn, släcks när pekaren lämnar fönstret). Sidhuvudets effekter provas i båda lägena för genomskinlighet, och telefonens sidhuvud är rgb(18, 18, 17).

Miljön på den här datorn:
- Windows genomskinlighetseffekter är avstängda, så Chromium och Edge rapporterar `prefers-reduced-transparency: reduce` och sajten visar ingen oskärpa. Det är rätt beteende. Proven ställer in läget själva via CDP.
- Ofarliga fel i konsolen: `ERR_SSL_PROTOCOL_ERROR` kommer från förhämtningen av /admin, som svarar 307 till /logga-in och då uppgraderas till https av CSP:n på http://localhost. 404, 400, `ERR_FAILED` och felen utan nät kommer från prov som gör så med flit.

Resultat:
- Hela e2e-sviten mot produktionsbygget (`next start`), körd ensam: 234 av 234.
- Fem storlekar (320, 390, 768, 1280 och 1440) i Chromium och WebKit, tolv sidor, mörkt på alla och ljust på 390 och 1440: inget bredare än skärmen, all CSS laddad, inga fel i konsolen utöver förhämtningen.
- Datorn med reducerad rörelse (i Chromium också utan genomskinlighet), 1280 och 1440, båda motorerna: allt innehåll syns, inga animationer går och rutnätets ljus är av.
- STAR-sidan efter heron på telefon och dator: rätt efter lagningen av himlen. Citatet i sidfoten skrivs klart i båda motorerna.
- Ankarproven: menylänkarna "Vad studenterna kan" och "Håll en lunchföreläsning" från olika sidor, överst och nedskrollat, på dator och telefon i båda motorerna, och samma sak med 1,5 s fördröjda svar: 60 av 60 hamnar rätt. Lunchlänken från /nyheter på telefon landade rätt varje gång (rubriken 152 px ner).

## Anteckningar för den som fortsätter

- **Inställningarna:**
  - De läses i `getSettings` i `src/lib/data/content.ts`, och bara nycklar som finns i `DEFAULT_SETTINGS` följer med. En ny nyckel måste därför in där och i `SiteSettings` i `src/lib/types.ts`.
  - `saveSettings` skriver bara de nycklar som finns i formuläret.
- **Redigeringslägets mål:** de står i `src/components/edit-mode/store.ts` (`EditTarget`, `canEditTarget`). Ett nytt mål behöver nya fall i tre switchar i `edit-drawer.tsx` och i en i `src/app/api/admin/redigera/route.ts`.
- **Behörigheten för näringslivet:** `canManageNaringsliv` i `src/lib/data/naringsliv.ts` läser databasen och går inte att använda i klienten.
- **Vad studenterna kan i koden:** `StudenternasKompetens` och `Branscher` används på `/foretag` och i STAR-inbjudan (med `natt`). Båda läser blocken `kompetens` och `branscher` med `getBlock`, och det gör sökningen i `src/lib/data/search-index.ts` också.
- **Menyn i koden:** `MenyTrad` i `src/components/layout/meny-trad.tsx` ritar sidomenyn och telefonmenyn. Skalet visar `NAV`, och `SparadMeny` byter in den sparade menyn i ett Suspense-hål (`(site)/layout.tsx`). Sidfoten och sökningen läser `synligMeny(await getBlock("meny"))`.
- **Listor i listor:** en rad i `RLista` hindrar länkar med `onClickCapture`, men bara för klick i radens egen DOM. Rutan för en inre lista ligger i en portal och passerar raden i Reacts träd.
- **Block i det nya läget:** ett block sparas som `innehall:<namn>` i `settings` och tas bort när det blir lika med standardvärdet. Schemat och standardvärdet står i `src/lib/innehall/block/`, och komponenten använder `useBlock`, `RFalt` och `RLista`.
