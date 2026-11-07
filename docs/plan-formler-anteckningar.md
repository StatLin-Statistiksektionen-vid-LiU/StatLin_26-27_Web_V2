# Plan: formler i LaTeX och flyttbara anteckningar

Önskemålet (2026-11-07): formlerna i rutnätet och anteckningarna med pil ska gå att ändra, flytta och ta bort. Formlerna skrivs
i LaTeX. Formlerna ska skrivas fram för hand innan de tonas bort, även när animationseffekterna är av i Windows.

## 1. Formlerna i rutnätet

- Formlerna sparas i blocket Handskriften, bredvid citaten i sidfoten. Standard är dagens 15 formler, omskrivna till LaTeX.
- I redigeringsläget står alla formler i en lista i sidfoten under citaten. Där läggs de till, ändras, tas bort och byter ordning.
  Rutan för en formel har fälten Formeln i LaTeX och Rödpenna, och visar formeln medan man skriver.
- De skrivs fortfarande där ljuset är, i en tom yta nära pekaren, aldrig över text eller genom en linje.

## 2. LaTeX för hand

En egen liten LaTeX-tolk som ritar formeln i handstilen Mynerve, så att den kan skrivas fram tecken för tecken.

- Stöds: `x^2`, `x_i`, `{}`, `\frac` och `\dfrac`, `\sqrt` och `\sqrt[n]`, `\sum`, `\prod` och `\int` med gränser, `\lim`, `\max`,
  `\min`, `\log`, `\ln`, `\exp`, `\operatorname`, `\text`, `\mathrm`, `\mathbb`, `\mathbf`, `\bar`, `\hat`, `\tilde`, `\vec`,
  `\overline`, `\left( \right)`, `\binom`, alla grekiska bokstäver, relationer som `\leq \geq \neq \approx \sim \in \to`, och
  mellanrum som `\,` och `\quad`. Kommatecken mellan siffror blir decimalkomma, som 1,96.
- Mynerve har alla grekiska bokstäver men inte tecken som √, ≤, ≠, ∞, ∫ och →. De ritas som streck för hand i stället, så att
  inget hamnar i ett annat typsnitt.
- Bråkstrecket, rotens streck och parenteser som växer med innehållet ritas också för hand.
- Ett kommando som tolken inte känner igen skrivs som text, och rutan säger vilket det är.

## 3. Skrivanimationen

- Formeln skrivs i den ordning man skriver för hand: täljaren, bråkstrecket och nämnaren, roten före det som står under den.
- Den skrivs fram även med animationseffekterna av. Det är bara bläck som syns fram, inget som rör sig. Sedan står den kvar
  en stund och tonas bort som i dag.

## 4. Anteckningarna med pil

- Alla anteckningar sparas i ett nytt block, Anteckningarna. Varje anteckning har sidan den står på, texten, det den pekar på
  (ett ord på sidan, eller slutet av rubriken), och rödpenna eller bläck. De fem som finns i dag följer med, och texter som
  ändrats i Admin följer också med.
- I redigeringsläget:
  - dra anteckningen dit den ska stå,
  - dra pilens spets till ordet den ska peka på,
  - klicka på den för att ändra texten, ordet och färgen, eller ta bort den,
  - knappen Ny anteckning lägger till en på sidan man står på.
- För besökare står anteckningen där den lades. Krockar den med text eller får den inte plats, som på en smal telefon, provas
  platserna runt ordet, och får den inte plats någonstans syns den inte. I redigeringsläget syns den ändå, med en streckad ram
  som säger att besökare inte ser den där.
- Anteckningarnas fält under sidhuvudena i Admin tas bort, eftersom de nu ändras där de står.

## 5. Prov

- Tolken provas med alla standardformler och med trasig LaTeX (okända kommandon, klamrar som inte stängs).
- Skärmbilder av alla formler, i ljust och mörkt läge, i Chromium och WebKit.
- Rutnätet: formlerna skrivs fram även med reducerad rörelse, ingen linje genom dem.
- Anteckningarna: de fem står som förut, och att flytta, peka om, ändra, lägga till, ta bort och spara fungerar.
- tsc, eslint och hela e2e-sviten, ensam.

Inget läggs ut förrän du säger ja. Menylagningen från i morse följer med i samma fråga.
