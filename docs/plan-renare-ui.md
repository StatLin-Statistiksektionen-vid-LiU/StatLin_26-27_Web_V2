# Renare gränssnitt i V2

Skriven 2026-11-14 som plan och uppdaterad samma dag till det som faktiskt byggdes. Gäller den publika sajten i grenen `ny-design` (appen statlin-web-v2). Adminpanelen ser redan lugn ut och är inte omgjord. Allt ligger okommittat i arbetsträdet tills det finns ett ja till commit, push och utläggning.

## Önskemålen

1. Gränssnittet känns rörigt och inte rent. Det ska bli tydligt snyggare och lättare att förstå.
2. Styrelsekorten utan foto var snyggare som de var, i alla fall i mörkt läge: mörk platta med röd ton, ringar och breda initialer.
3. Framsidan behöver förenklas.
4. De ritade bilderna på evenemang och nyheter utan foto är fula och ska få snyggare design.
5. Sidan ska vara lättare att titta på.
6. Handstilen är ful och ska bytas.
7. En stilgranskare (Opus 5.5) ska få titta på resultatet.

## Regler efter städningen

- **En röst i rubrikerna.** Rubriker står i Archivo. Ett ord kan vara rött, alltid sajtens röda, i samma typsnitt. Mono används för etiketter, datum och siffror.
- **En rubrik är störst.** Sidans huvudrubrik är störst. Sektionernas rubriker är ett tydligt steg mindre, högst 2,25 rem.
- **Rött markerar hela ord.** Sammansatta ord får delas i sin fog (Tenta och statistik, Hjälp och medel). Enkla ord står i en färg.
- **En röd per del.** I mörkt läge finns en klar röd för rubriker och linjer och en ljusare för liten text som ska gå att läsa. De blandas inte i samma rubrik eller samma del.
- **Handstil är en anteckning.** Den skrivs i Caveat Brush, står som den är skriven också i rubriker med versaler, och rödpennan har rubrikens röda. Högst två handskrivna saker per skärm är lagom.
- **Platshållare är plattor.** En nyhet, ett evenemang eller en post utan bild får en platta med en ton av färg, tunna ringar och ett märke. Inga ritade diagram.
- **Med fingret är allt 44 px.** Det som går att trycka på är minst 44 px högt på pekskärm, utan att raderna runt om flyttas.
- **Osynligt, inte borttaget.** Text som inte ska synas på telefon görs osynlig (`invisible`) i stället för att tas bort ur sidan (`hidden`). Anteckningarna med pil räknar ordens förekomster, så annars pekar samma anteckning på olika ord i olika bredder.

## Startsidan

Startsidan är kortare och har färre saker som tävlar om blicken. Med samma innehåll är den 3544 px hög på dator (förut 4450) och 5921 px på telefon (förut 7779), alltså ungefär 20 och 24 procent kortare.

Borttaget:

- Texten om sektionen under heron, med sin lilla rad ovanför och knapparna Om StatLin och Möt styrelsen. Samma sidor nås från menyn och från siffrorna.
- De små raderna under siffrorna ("väljs varje år", "just nu i kalendern").
- Rutan Prenumerera på kalendern under tidslinjen. Prenumerationen finns kvar som röd knapp på /evenemang, i sidfoten och bland länkarna.
- Koordinaterna och ordet StatLin vid loggan. Kvar står "Fig. 1" och "n = alla".
- Den pulserande pricken vid den lilla raden över rubriken. Pricken står still.

Nytt eller ändrat:

- Heron slutar med en rad med fyra tal: utskott, poster i styrelsen, kommande evenemang och program. Varje tal är en länk dit.
- Loggan är mindre på telefon, så att rubriken och knapparna syns på första skärmen.
- Genvägarna står i två jämna kolumner på telefon. På dator är Frågelådan en textlänk bredvid Alla länkar i stället för ett chip som hamnar ensamt på en egen rad.
- Under Nytt står den senaste nyheten stor med bild, och de andra som rader med datum, rubrik och ingress.
- Alla delar har samma luft över och under sig. Luften skiljer delarna åt, inte fler linjer.
- De två korten sist (Ny student och STAR) är lika höga, och deras rubriker är mindre än sidans huvudrubrik.
- Vattenmärket i det röda kortet tonar ut innan det når texten.

De sparade texterna för det som togs bort ligger kvar i databasen men visas inte. Fältet Om sektionen finns inte längre under Startsidan i Admin, och textgruppen heter Startsidan: siffrorna.

## Ändringar i resten av sajten

| Del | Ändring | Filer |
|---|---|---|
| Rubriker | Röda ord står i rubrikens typsnitt och i sajtens röda. Sektionsrubriker är mindre än sidans huvudrubrik. På telefon står länken på etikettens rad i stället för ensam under rubriken. | `accent-text.tsx`, `section-heading.tsx`, `sektionen/page.tsx`, `utskott/[slug]/page.tsx`, `nyheter/page.tsx`, `logga-in/page.tsx`, `not-found.tsx` |
| Sidtitlar | Evenemang, Utskott, Galleri, Dokument och Styrelsen står i en färg i stället för rött mitt i ordet. | `site-texts.ts`, `migrations.ts` (steg 21), `scripts/lib.mjs` |
| Omslag utan bild | Platta med en ton i utskottets färg, tunna ringar och utskottets logga i mitten. Utan utskott står sektionens märke stort och svagt till höger. | `cover-art.tsx`, `globals.css`, `evenemang/[slug]/page.tsx`, `news-card.tsx` |
| Styrelsekort | Plattan med röd ton, ringar och initialer är kvar som den var. Bara mejllänkens tryckyta är större. | `board-card.tsx` |
| Handstil | Caveat Brush i stället för Mynerve, se nedan. | `globals.css`, `skrivning.tsx`, `handskrift.tsx`, `formel.ts`, `public/fonts/` |
| Tidslinjen | Linjen har rubrikens röda. Länken till kalendern ser ut som övriga länkar vid rubrikerna. | `globals.css`, `upcoming-timeline.tsx` |
| Utskottsprickar | En svart eller mörk utskottsfärg lyfts i mörkt läge, så att pricken syns. Ljusa färger står som de är. | `globals.css`, `evenemang/page.tsx`, `event-card.tsx`, `page-hero.tsx` |
| Sponsorer | Raden står på sidans egen yta i stället för ett vitt band, med loggorna på små vita plattor. | `sponsors.tsx` |
| Sidfot | Slogan, citat och kontakt står under länkarna efter en hårlinje, i tre kolumner på bred skärm. Lägre totalhöjd. | `site-footer.tsx` |
| Tryckytor | Länkar, chip, knappar, sidnummer och menyrader är 44 px höga med fingret. | `globals.css` (`.tryck`), `site-header.tsx`, `meny-trad.tsx`, `site-footer.tsx`, `star/page.tsx`, `grafisk-profil/page.tsx`, `exam-chart.tsx`, `course-search.tsx`, `resource-board.tsx`, `site-search.tsx`, `login-form.tsx`, `studenternas-kompetens.tsx` med flera |
| Skärmläsare | Knappars namn börjar med texten som syns. Raderna i evenemangets faktaruta läses som par. Sidomenyn har ett namn. Länktavlans rubrik är bara gruppens namn. Menyn säger var man är också på undersidor. | `theme-toggle.tsx`, `site-header.tsx`, `meny-trad.tsx`, `evenemang/[slug]/page.tsx`, `link-board.tsx` |
| Kontrast | Liten röd text har den läsbara röda. Sökträffar har textens färg. Kurvan på 404-sidan syns i mörkt läge. | `kandidat/page.tsx`, `master/page.tsx`, `grafisk-profil/page.tsx`, `search-parts.tsx`, `not-found.tsx` |

Egna texter ändras inte. Den som har skrivit en egen rubrik i Admin behåller den, och kan fortfarande markera ord med `*ord*` och `_ord_`. De fem sidtitlarna byts i databasen bara där den sparade texten är exakt den gamla standardtexten (migreringssteg 21, samma sätt som steg 20).

## Handstilen

- Handskriven text står i **Caveat Brush** (SIL Open Font License, två filer i `public/fonts/`). Den har ett kraftigare streck som håller mot rubrikernas feta Archivo. Mynerves tunna streck var det som såg svagt ut.
- Storlekar: ord i en rubrik 1,08 em, fraser i löptext 1,2 em, en egen rad 1,35 em, anteckningar med pil 1,5 rem (1,35 rem på telefon), citatet i sidfoten 1,5 rem.
- Caveat Brush saknar grekiska bokstäver. De hämtas ur Mynerves grekiska fil, skalade till penselns höjd, så att ett β inte gör raden högre.
- **Formlerna står kvar i Mynerve.** Formelsättaren och de ritade tecknen är uppmätta i det typsnittet, och det har grekiskan.
- Medan typsnittet hämtas tar texten samma plats i ett vanligt typsnitt som är skalat till penselns mått, så att sidan inte hoppar.

## Stilgranskarens tolv punkter

| Nr | Punkt | Beslut |
|---|---|---|
| 1 | Sektionsrubrikerna var större än sidans huvudrubrik, och Ny student var störst på sidan. | Gjort. Sektionsrubriker högst 2,25 rem, kortens rubriker högst 2,75 rem. |
| 2 | Handstilens streck var för tunt bredvid rubrikerna. | Gjort. Caveat Brush med storlekarna ovan. |
| 3 | Heron hade fyra handskrivna saker, en pulserande prick och fyra små etiketter. | Gjort, utom de handskrivna texterna: de är egna sparade texter och är inte ändrade. Rådet är högst två handskrivna saker per skärm. |
| 4 | Anteckningen i heron lästes som slutet på en mening, och "hitta snabbt" pekade på fel ord. | Flyttade i provdatabasen. I produktionen dras anteckningarna dit de ska stå i redigeringsläget. |
| 5 | Omslagen: loggan för stor, ringarna hörde inte ihop med den, och mörka utskottsfärger blev grumliga. | Gjort. Mindre logga med ringarna omkring, och ren ton i mörkt läge. |
| 6 | Startsidans nyhetsplatta var stor och byggd kring samma märke som redan syns överallt. | Gjort. Lägre platta utan foto, och märket som svagt vattenmärke när utskott saknas. |
| 7 | På telefon hängde länken ensam under varje rubrik, och kalendern upprepade den i annan stil. | Gjort. |
| 8 | Formler i Caveat Brush i fet stil, med grekiskan i syntetisk fetstil. | Inte gjort. Formlerna är kvar i Mynerve, som sättaren är uppmätt i. |
| 9 | Tidslinjens linje hade en annan röd än rubrikens röda ord. | Gjort. |
| 10 | Genvägarna: Frågelådan ensam på egen rad på dator, fyra ojämna rader på telefon. | Gjort. |
| 11 | Olika luft mellan delarna. | Gjort, med något mindre luft än förslaget (3 till 5 rem). |
| 12 | STIG:s svarta prick syntes inte i mörkt läge. | Gjort. Mörka färger lyfts, ljusa står kvar. |

## Lagning i redigeringsläget

En anteckning vars ord står i den del av tidslinjen som är bortrullad i sidled lades långt till höger och gjorde sidan 2777 px bred i redigeringsläget. Den hålls nu inom sidans bredd, pilen pekar mot kanten där ordet försvann, och raden säger "Ordet står utanför bild, så besökare ser den inte". Besökare såg aldrig felet. Filer: `anteckning-lager.tsx`, `anteckning-redigerare.tsx`.

## Projektet

- Kod som inte användes är borttagen: bakgrundsgrafen `data-field.tsx` med sin CSS, stilfilen `hero.css` som ingen sida läste in, `standardInnehall`, `STATUS_ORDER`, `isSiteTextGroup`, knapparna under Om i startsidans block och reservrutan för tidslinjen.
- README och `docs/plan-onskemal.md` beskriver plattorna och det nya typsnittet.
- Databasen går från version 20 till 21 vid nästa utläggning (steg 21, de fem sidtitlarna).

## Kontroll

- **Lint och typkontroll:** utan anmärkning.
- **Datumtest:** 42 av 42.
- **Bygge:** `npm run build` går igenom.
- **E2e:** 234 av 234 steg, kört ensamt mot produktionsbygget av exakt det som ligger i arbetsträdet. Sviten gick igenom tre gånger under passet, sist efter den sista lagningen.
- **Webbläsare:** startsidan, evenemang, nyheter, styrelsen och redigeringsläget är sedda i Chromium och WebKit, i mörkt och ljust läge, på dator, surfplatta och telefon. Ingen sida sticker ut i sidled vid 320, 390, 768, 1024 eller 1440 px.
- **Mätning** av 29 publika sidor i fyra lägen (mörkt och ljust, dator och telefon), med axe och egna mått. Samma sidor före passet och på slutbygget:

| Mått | Före | Efter |
|---|---|---|
| Fynd i axe, totalt | 358 | 78 |
| Kontrast | 144 | 78 |
| Namn som inte innehåller texten som syns | 108 | 0 |
| Listor som skärmläsare inte läser som par | 28 | 0 |
| För små tryckytor enligt axe | 76 | 0 |
| Tryckytor under 24 px på telefon | 12 | 0 |
| Tryckytor mellan 24 och 43 px på telefon | 1552 | 0 |
| Rubriker med två typsnitt | 60 | 0 |

Det som är kvar är kontrast, och båda sakerna är medvetna val:

- Vit text på sajtens röda (röda knappar, chippen Fäst och I dag, dagens datum i kalendern) har 3,97:1. Kravet för liten text är 4,5:1. Färgen är sektionens röda ur den grafiska profilen, så den är inte ändrad. En något djupare röd bakom vit text (ungefär #eb0000) skulle klara kravet, om det önskas.
- Kalenderns dagar utanför månaden är nedtonade med flit (3,45:1).

Tre saker hittades i slutkontrollen och lagades:

- Loggans länk i sidomenyn hade ett namn som inte ordagrant innehöll texten som syns.
- Länken Allt nytt på telefon hade en tryckyta som klipptes av sektionens kant, så att fingret bara träffade 34 av 45 px.
- I sidfoten på telefon hamnade de röda ikonerna vid Kalenderflöde och In English på en egen rad under texten. Felet fanns redan före passet och syns bara på pekskärm.

Den stora mätningen gjordes efter de två första lagningarna. Den tredje ändrar bara hur två länkar i sidfoten ställs upp. Den är kontrollerad för sig i Chromium och WebKit, och fem sidor mättes om i alla fyra lägen på slutbygget utan nya fynd.

## Att tänka på vid utläggning

- Anteckningar på startsidan i produktionen kan peka på en annan förekomst av sitt ord efteråt, eftersom text har tagits bort från sidan. Titta på startsidan efter utläggningen och dra dem rätt i redigeringsläget.
- Postguiden (artefakten i Claude) har kvar den gamla handstilen.
- Blender-proven av omslagen (renderad bakgrund och loggan som 3D-märke) är inte med. Omslagen här är de kodritade plattorna.
- Inget läggs ut, committas eller pushas utan ett ja.
