# Handoff 2026-11-16

Written for the next chat and for Christian. It says where everything is, how the project is laid out, what state it was left in, what is checked and what is not.

## 1. Where things are

| What | Where |
| --- | --- |
| The current version (all code) | `C:\Users\Nezzo\OneDrive\Desktop\Uni\StatLin 26_27\Statlin Web\.claude\worktrees\ny-design` |
| Branch with everything committed | `polished_dessine_1` (local only, not pushed) |
| This file | `docs\overlamning-2026-11-16.md` in the folder above |
| Extra copy of the same work | git ref `refs/sakring/ny-design-2026-11-16` (commit `609c2f1`), made before the commit |
| Test database, login states, launchers, small tools | `C:\Users\Nezzo\OneDrive\Desktop\Uni\StatLin 26_27\Statlin Web\.claude\ny-design-prov\` (git-ignored, only on disk) |
| Server definitions for the preview panel | `C:\Users\Nezzo\OneDrive\Desktop\Uni\StatLin 26_27\Statlin Web\.claude\launch.json` |
| Earlier plans | `docs\plan-onskemal.md`, `docs\plan-renare-ui.md`, `docs\plan-formler-anteckningar.md`, `docs\atgardsplan.md` |
| Post guide source | `docs\postguide.html` (artifact 58eaff62 in Claude) |
| Notes that carry over between chats | `C:\Users\Nezzo\.claude\projects\C--Users-Nezzo-OneDrive-Desktop-Uni-StatLin-26-27-Statlin-Web\memory\` (index in `MEMORY.md`) |

The base of the branch is `62a1741` on branch `ny-design`. That commit is what runs in production as `statlin-web-v2` release v7. Everything after it (217 files) is in the single commit on `polished_dessine_1`.

Nothing is pushed and nothing is deployed. Ask Christian before commit, push or deploy.

## 2. How the project is laid out

Next.js 16.4 (Turbopack, Cache Components, PPR), React 19, Tailwind v4, strict TypeScript, SQLite through better-sqlite3. `AGENTS.md` says to read `node_modules/next/dist/docs/` before touching Next APIs, because this version differs from older ones.

```
src/app/(site)/      public site
  page.tsx             start page (hero, sections)
  evenemang, nyheter, sektionen (with styrelsen), utskott, studenter, foretag,
  star, lunchforelasningar, tentastatistik, dokument, galleri, fragelada,
  kontakt, sok, grafisk-profil, integritet
src/app/admin/       the portal for the board and committees
  page.tsx             overview with greeting and "to do now"
  projektplaner        plans, with collaborators and one thread per plan
  chatt                threads (plan threads live here)
  uppdrag, moten, arshjul, evenemang, nyheter, dokument, bilder, lankar,
  partners, star, intresseanmalningar, lunchonskemal, fragelada, sidor,
  utskott, styrelsen, konton, konto, installningar, hjalpmedel
src/app/api/         route handlers (for example /api/admin/aviseringar)
src/components/
  home/                hero.tsx, hero-fit.tsx (the curve), hero-grid.tsx, home-sections.tsx
  layout/              header, footer, announcement pill
  admin/               forms, sidebar.tsx, aviseringar.tsx (bell), todo-now.tsx, chatt/
  karaktar/, brand/    committee marks and intros (motiv-utskott.tsx)
  ui/, icons.tsx       shared parts
src/lib/
  db/                  index.ts, migrations.ts (24 steps), bootstrap.ts
  data/                all reads and writes (chatt.ts, aviseringar.ts and so on)
  auth/                sessions and roles
  chatt.ts, dates.ts, markdown.ts and so on: pure helpers
src/app/globals.css  all CSS (CSS modules do not work here)
scripts/             seed.ts, create-admin.mjs, create-accounts.mjs, logglager.mjs
tests/               e2e.mjs + e2e-steg/*.mjs (browser suite), *.test.mjs (unit tests)
public/brand/        logos, committee layers in utskott/lager/
```

Site texts and code comments are Swedish. Newer code uses Swedish names. No em-dashes or en-dashes anywhere.

## 3. State as left

### Built in this round (all in the commit)

- **Plan collaborators.** A plan can have named collaborators or everyone (`plan_collaborators`, `collab_all`, migration 24).
- **Plan threads.** Each plan has its own thread in the chat (`src/lib/chatt.ts`, `src/lib/data/chatt.ts`, `src/components/admin/chatt/`).
- **Notifications.** The bell in the portal menu lists new thread messages, invitations, new tasks and things that came in from the site (`src/lib/data/aviseringar.ts`, `/api/admin/aviseringar`, `src/components/admin/aviseringar.tsx`, `todo-now.tsx`). The rows exist in the page only while the bell is open.
- **Styrelsen** is its own page `/sektionen/styrelsen`, not a committee, without drawing around the logo. Vice chair and secretary are one person and share a card.
- **UBU and SASU intros** on the committee pages (`motiv-utskott.tsx`, `.entre` in `globals.css`, layers from `scripts/logglager.mjs`, `LAGER_V = "06a50657"`).
- **Cleaner UI pass** from 2026-11-14 (see `docs/plan-renare-ui.md`).
- Small fixes on 2026-11-16: footer links wrap at 280 px, no layout shift on `/evenemang` on phones, a plan thread counts as read only when the bottom of its messages is on screen.
- **Hero curve.** A stepwise version was built and then undone at Christian's request. `src/components/home/hero-fit.tsx` is the earlier curve again (third degree, new sample every nine seconds). The undone version is saved as `hero-fit.stegvis.tsx` in the test folder. Do not rebuild the hero without asking what is missing.

### Checked

- Browser suite (e2e) against the production build: 233 of 233. That run was before the hero undo and before the read-marker fix in `chat-view.tsx`.
- After those two changes: `tsc` clean, `eslint` clean, unit tests 123 of 123. The browser suite was not rerun.
- "Hela StatLin" flow (plan for everyone, thread, notification) works in Edge desktop dark and WebKit phone light.
- Phone link answered 200 with CSS and fonts from the laptop. Not tried on a real phone by me.

### Not checked or not done

- Six review points left by the sub chat: the bell in detail, the plan page at 390 px, the hero, the UBU and SASU intros, styrelsen and the master view, the footer in WebKit.
- Likely fault, unconfirmed: Escape while focus is on a row in the bell hides the panel without moving focus back to the bell button.
- The shared card for vice chair and secretary has not been seen with real names.
- Christian has not said what he thinks of the UBU and SASU intros, or of the Blender cover tests.
- Open from `docs/plan-onskemal.md`: UBU content, the Discord link, `**` in headings.
- Waiting on Christian in Admin: SMTP settings and the test content.
- Christian said he has a lot more to bring up. Start by listening.

### Production

- Live: app `statlin-web-v2` on Fly, release v7, commit `62a1741`, database at step 20.
- This branch has migration steps 21 to 24. They run by themselves at start. Take a volume snapshot first (read the volume id before the snapshot).
- The automatic safety check can block reads from production even after a yes. Give Christian the command to run instead.

## 4. How to run it

Use the preview panel with the names in `launch.json`. All three use the test database in `.claude\ny-design-prov\ny-design-data\` (step 24, 4 plans, 22 accounts).

| Name | Address | What |
| --- | --- | --- |
| `ny-design` | http://ny-design.localhost:3400 | dev server |
| `ny-design-prod` | http://localhost:3500 | production build, for the browser suite |
| `ny-design-telefon` | http://192.168.10.151:3300 | production build for a real phone on the same Wi-Fi |

- The phone address works only while the computer is on, on the same Wi-Fi, with the server started. The computer's address can change, so read it again.
- Run `npx next build` before `ny-design-prod` or `ny-design-telefon`. Restart the dev server after every build, otherwise it serves old modules.
- If a CSS change does not show in dev, change the number in the marker comment in `globals.css` (now 58).
- After a new migration step, restart the dev server.
- Open local servers as `<name>.localhost:<port>`, not `127.0.0.1`.

Browser suite, from the test folder:

1. `npx next build` in the worktree, then restart dev.
2. `node e2e-seed.cjs` (fresh database for the run).
3. Start `ny-design-prod`.
4. `node e2e-kor.cjs http://localhost:3500 <log file>`. Results print only at the end. About 9.5 minutes on mains, 12.5 on battery. Run it alone.

Other checks in the worktree: `npx tsc --noEmit`, `npx eslint`, `npx tsx --test tests/*.test.mjs`.

Test accounts: login states for four roles are in the test folder (`av-admin.json`, `av-scb.json`, `av-kassor.json`, `av-agare.json`, valid until 2026-11-18). New ones are made with `sess-konto.cjs`. Do not write test passwords in chat.

## 5. So nothing disappears

- Everything is in the commit on `polished_dessine_1`. Same content as `refs/sakring/ny-design-2026-11-16`.
- To get the files back as they were: `git checkout polished_dessine_1 -- .` (or the ref above).
- The test folder is not in git. It is in OneDrive with the rest of the project folder. Do not delete `.claude\ny-design-prov\`.
- Never use a bare `git stash` here, the stash is shared with other worktrees.
- Branch `ny-design` still points at `62a1741`, untouched.

## 6. What Christian wants (short)

- Small steps, shown early with a link. Ask before anything over about 15 minutes.
- Remove rather than add. Calm and dark with one clear red. Tone, rings and the section mark, not drawn charts.
- Do it properly, no sloppy work.
- Hand off bounded parts to sub chats on Opus 5.5 without being asked each time. The master chat on Fable 5.2 decides and reviews. Only those two models.
- Ask before commit, push and deploy.
- The chair (ordförande) is an admin.

## 7. Sub chat

`Statlin-web-sub-kontroll` (Opus 5.5) shares this folder and is paused. It finished point 1 of 7 and made the read-marker fix. Its points 2 to 7 are the list under "Not checked" above. It wrote notes in a file called `granskning-sju-delar.md`, which I could not find on disk. Ask it for the path if the notes are needed.
