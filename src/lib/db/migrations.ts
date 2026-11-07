import type Database from "better-sqlite3";

/**
 * Migreringar körs i ordning och spåras med PRAGMA user_version.
 * Lägg alltid till nya steg sist – ändra aldrig ett steg som redan körts i drift.
 * Skripten i scripts/ vägrar köra mot ett annat schema än sitt eget: höj EXPECTED_USER_VERSION i
 * scripts/lib.mjs i samma ändring som ett nytt steg (skripten kan inte importera den här filen).
 */
const steps: string[] = [
  /* 1: grundschema */ `
  CREATE TABLE media (
    id            INTEGER PRIMARY KEY,
    kind          TEXT NOT NULL CHECK (kind IN ('image','file')),
    path_base     TEXT NOT NULL,
    ext           TEXT NOT NULL,
    variants      TEXT NOT NULL DEFAULT '',
    original_name TEXT NOT NULL,
    mime          TEXT NOT NULL,
    size          INTEGER NOT NULL,
    width         INTEGER,
    height        INTEGER,
    color         TEXT,
    alt           TEXT NOT NULL DEFAULT '',
    uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE committees (
    id             INTEGER PRIMARY KEY,
    slug           TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL,
    short_name     TEXT NOT NULL,
    tagline        TEXT NOT NULL DEFAULT '',
    description_md TEXT NOT NULL DEFAULT '',
    logo_url       TEXT,
    accent         TEXT NOT NULL DEFAULT '#ff0707',
    email          TEXT NOT NULL DEFAULT '',
    instagram      TEXT NOT NULL DEFAULT '',
    kind           TEXT NOT NULL DEFAULT 'utskott' CHECK (kind IN ('styrelse','utskott','ovrigt')),
    sort_order     INTEGER NOT NULL DEFAULT 0,
    visible        INTEGER NOT NULL DEFAULT 1,
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE users (
    id                   INTEGER PRIMARY KEY,
    email                TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name                 TEXT NOT NULL,
    post                 TEXT NOT NULL DEFAULT '',
    role                 TEXT NOT NULL CHECK (role IN ('admin','editor','committee')),
    committee_id         INTEGER REFERENCES committees(id) ON DELETE SET NULL,
    password_hash        TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    active               INTEGER NOT NULL DEFAULT 1,
    failed_logins        INTEGER NOT NULL DEFAULT 0,
    locked_until         TEXT,
    last_login_at        TEXT,
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE sessions (
    id           TEXT PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    expires_at   TEXT NOT NULL,
    user_agent   TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE board_members (
    id             INTEGER PRIMARY KEY,
    post           TEXT NOT NULL,
    name           TEXT NOT NULL DEFAULT '',
    email          TEXT NOT NULL DEFAULT '',
    bio            TEXT NOT NULL DEFAULT '',
    photo_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    committee_id   INTEGER REFERENCES committees(id) ON DELETE SET NULL,
    sort_order     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE events (
    id             INTEGER PRIMARY KEY,
    slug           TEXT NOT NULL UNIQUE,
    title          TEXT NOT NULL,
    summary        TEXT NOT NULL DEFAULT '',
    body_md        TEXT NOT NULL DEFAULT '',
    starts_at      TEXT NOT NULL,
    ends_at        TEXT,
    all_day        INTEGER NOT NULL DEFAULT 0,
    location       TEXT NOT NULL DEFAULT '',
    location_url   TEXT NOT NULL DEFAULT '',
    committee_id   INTEGER REFERENCES committees(id) ON DELETE SET NULL,
    cover_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    signup_url     TEXT NOT NULL DEFAULT '',
    price          TEXT NOT NULL DEFAULT '',
    published      INTEGER NOT NULL DEFAULT 1,
    created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX events_starts ON events(starts_at);

  CREATE TABLE event_images (
    id          INTEGER PRIMARY KEY,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    media_id    INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    caption     TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX event_images_event ON event_images(event_id, sort_order);

  CREATE TABLE news (
    id             INTEGER PRIMARY KEY,
    slug           TEXT NOT NULL UNIQUE,
    title          TEXT NOT NULL,
    excerpt        TEXT NOT NULL DEFAULT '',
    body_md        TEXT NOT NULL DEFAULT '',
    cover_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    committee_id   INTEGER REFERENCES committees(id) ON DELETE SET NULL,
    published      INTEGER NOT NULL DEFAULT 1,
    pinned         INTEGER NOT NULL DEFAULT 0,
    published_at   TEXT NOT NULL,
    author_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX news_published ON news(published_at);

  CREATE TABLE documents (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    category    TEXT NOT NULL CHECK (category IN ('styrdokument','protokoll','grafiskt','ovrigt')),
    description TEXT NOT NULL DEFAULT '',
    media_id    INTEGER REFERENCES media(id) ON DELETE SET NULL,
    url         TEXT NOT NULL DEFAULT '',
    doc_date    TEXT,
    published   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE pages (
    slug       TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    lead       TEXT NOT NULL DEFAULT '',
    body_md    TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE partners (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    url           TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    logo_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    tier          TEXT NOT NULL DEFAULT 'partner' CHECK (tier IN ('huvudpartner','partner')),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    active        INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE audit_log (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action     TEXT NOT NULL,
    entity     TEXT NOT NULL,
    entity_id  TEXT,
    summary    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX audit_created ON audit_log(created_at);
  `,
  /* 2: styrelsens granskning av evenemang – det som redan finns räknas som granskat */ `
  ALTER TABLE events ADD COLUMN checked_at TEXT;
  ALTER TABLE events ADD COLUMN checked_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  UPDATE events SET checked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');
  `,
  /* 3: Studenter-fliken – sidtexter som fortfarande är ursprungliga nämner nu även mastern */ `
  UPDATE pages SET title = 'Kandidat' WHERE slug = 'utbildning' AND title = 'Utbildning';
  UPDATE pages SET lead = 'Grattis till platsen! Här är allt du behöver veta inför starten – på kandidaten eller mastern.'
    WHERE slug = 'ny-student' AND lead = 'Grattis till platsen! Här är allt du behöver veta inför starten på Statistik och dataanalys.';
  `,
  /* 4: uppdragstavlan – uppdrag mellan styrelsens poster (ett konto per post) */ `
  CREATE TABLE tasks (
    id           INTEGER PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    to_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL = öppet, vem som helst kan ta det
    status       TEXT NOT NULL DEFAULT 'planerad' CHECK (status IN ('planerad','pagar','hjalp','klar')),
    shared       INTEGER NOT NULL DEFAULT 1,                      -- syns för hela styrelsen
    due_date     TEXT,
    event_id     INTEGER REFERENCES events(id) ON DELETE SET NULL,
    assigned_at  TEXT,                                            -- när någon annan gav uppdraget till mottagaren
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    completed_at TEXT
  );
  CREATE INDEX tasks_to ON tasks(to_user_id, status);
  CREATE INDEX tasks_from ON tasks(from_user_id);
  CREATE TABLE task_comments (
    id         INTEGER PRIMARY KEY,
    task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX task_comments_task ON task_comments(task_id, created_at);
  ALTER TABLE users ADD COLUMN tasks_seen_at TEXT;
  `,
  /* 5: /sektionen läser nu sin rubrik från sidan, med StatLin i rött som tidigare – om ingen har ändrat den */ `
  UPDATE pages SET title = 'Om *StatLin*' WHERE slug = 'om' AND title = 'Om StatLin';
  `,
  /* 6: länksidan för studenter, programmens kurser och en cache för tentastatistiken */ `
  CREATE TABLE links (
    id          INTEGER PRIMARY KEY,
    label       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    url         TEXT NOT NULL,
    keywords    TEXT NOT NULL DEFAULT '',                         -- extra sökord, t.ex. "timeedit kalender"
    category    TEXT NOT NULL CHECK (category IN ('studier','tentor','it','campus','stod','statlin')),
    icon        TEXT NOT NULL DEFAULT 'link',
    featured    INTEGER NOT NULL DEFAULT 0,                        -- med i genvägsraden
    sort_order  INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE courses (
    id         INTEGER PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    credits    REAL NOT NULL,
    program    TEXT NOT NULL CHECK (program IN ('kandidat','master')),
    term       INTEGER NOT NULL,
    period     TEXT NOT NULL DEFAULT '',
    elective   INTEGER NOT NULL DEFAULT 0,
    url        TEXT NOT NULL DEFAULT '',                           -- t.ex. kurshemsidan
    sort_order INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX courses_program ON courses(program, term, sort_order);
  CREATE TABLE exam_stats (
    course_code TEXT PRIMARY KEY,
    data        TEXT NOT NULL,                                     -- källans svar, normaliserat
    fetched_at  TEXT NOT NULL
  );
  `,
  /* 7: grafiskt ansvar – kontot byter omslag, galleribilder och loggor på hela sajten och laddar upp grafiskt material */ `
  ALTER TABLE users ADD COLUMN design INTEGER NOT NULL DEFAULT 0;
  `,
  /* 8: programmens kurslista tas bort – tentastatistiken söks på kurskod – och länken till Y-sektionens tentastatistik */ `
  DROP TABLE IF EXISTS courses;
  DELETE FROM links WHERE url LIKE 'https://ysektionen.se/%';
  `,
  /* 9: hjälpmedel per program – fusklappar, GitHub-länkar och annat som styrelsen lägger upp */ `
  CREATE TABLE resources (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    program     TEXT NOT NULL CHECK (program IN ('kandidat','master','bada')),
    term        INTEGER CHECK (term BETWEEN 1 AND 6),               -- NULL = hela programmet
    category    TEXT NOT NULL CHECK (category IN ('fusklapp','kod','guide','ovrigt')),
    media_id    INTEGER REFERENCES media(id) ON DELETE SET NULL,
    url         TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  -- Länken överst i gruppen StatLin. En ny databas har inga länkar än och får den från SEED_LINKS efter migrationerna.
  INSERT INTO links (label, description, url, keywords, category, sort_order)
    SELECT 'Hjälpmedel', 'Fusklappar, GitHub-länkar och guider per program', '/studenter/hjalpmedel', 'fusklapp formelblad github kod guide', 'statlin',
      (SELECT COALESCE(MIN(sort_order), 0) - 1 FROM links WHERE category = 'statlin')
    WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'seeded_links');
  `,
  /* 10: årshjulet och projektplanerna – punkter som återkommer varje år, årets läge för dem och planer vars steg är uppdrag på tavlan */ `
  CREATE TABLE wheel_items (
    id            INTEGER PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    responsible   TEXT NOT NULL DEFAULT '',                       -- post eller utskott i klartext, så att punkten överlever att konton byts
    month         INTEGER CHECK (month BETWEEN 1 AND 12),          -- NULL = ingen bestämd månad, då gäller term
    term          TEXT CHECK (term IN ('vt','ht')),                -- följer månaden när den är satt
    depends_on    TEXT NOT NULL DEFAULT '',                       -- vem punkten beror på; tomt = bara på oss själva
    template      TEXT NOT NULL DEFAULT '',                       -- mallen en projektplan från punkten börjar med
    owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    seed_key      TEXT UNIQUE,                                     -- förslagets nyckel: samma förslag läggs aldrig in två gånger
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (month IS NOT NULL OR term IS NOT NULL)
  );
  CREATE INDEX wheel_items_month ON wheel_items(month);
  CREATE TABLE project_plans (
    id            INTEGER PRIMARY KEY,
    title         TEXT NOT NULL,
    template      TEXT NOT NULL,
    plan_date     TEXT NOT NULL,                                   -- dagen planen siktar på, YYYY-MM-DD
    responsible   TEXT NOT NULL DEFAULT '',
    goal          TEXT NOT NULL DEFAULT '',
    budget        TEXT NOT NULL DEFAULT '',
    lessons       TEXT NOT NULL DEFAULT '',                       -- lärdomar till nästa år, visas när nästa plan skapas från samma punkt
    owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    wheel_item_id INTEGER REFERENCES wheel_items(id) ON DELETE SET NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX project_plans_item ON project_plans(wheel_item_id, plan_date);
  CREATE TABLE wheel_item_state (
    item_id         INTEGER NOT NULL REFERENCES wheel_items(id) ON DELETE CASCADE,
    year            INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'oppen' CHECK (status IN ('oppen','planerad','klar','hoppad')),
    task_id         INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    project_plan_id INTEGER REFERENCES project_plans(id) ON DELETE SET NULL,
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (item_id, year)
  );
  ALTER TABLE tasks ADD COLUMN project_plan_id INTEGER REFERENCES project_plans(id) ON DELETE SET NULL;
  CREATE INDEX tasks_plan ON tasks(project_plan_id);
  `,
  /* 11: frågelådan – lådor med kod eller fast adress och anonyma frågor. Frågorna har med avsikt inga kolumner för namn, IP-adress,
     webbläsare eller klockslag, bara månaden (för gallringen efter 12 månader). Deras id slumpas, så att ordningen inte heller syns. */ `
  CREATE TABLE question_boxes (
    id          INTEGER PRIMARY KEY,
    slug        TEXT UNIQUE,                                        -- fast låda utan kod: /fragelada/<slug>
    code        TEXT UNIQUE,                                        -- sex tecken, se src/lib/fragelada.ts
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,    -- bara ägaren läser frågorna; utan ägare tar lådan inte emot något
    closes_on   TEXT,                                               -- YYYY-MM-DD, sista dagen lådan är öppen
    closed      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK ((slug IS NULL) != (code IS NULL))
  );
  CREATE TABLE box_questions (
    id      INTEGER PRIMARY KEY,                                    -- slumpat
    box_id  INTEGER NOT NULL REFERENCES question_boxes(id) ON DELETE CASCADE,
    body    TEXT NOT NULL,
    month   TEXT NOT NULL,                                          -- YYYY-MM
    seen    INTEGER NOT NULL DEFAULT 0,
    handled INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX box_questions_box ON box_questions(box_id, handled);
  CREATE INDEX box_questions_month ON box_questions(month);
  -- De fasta lådorna följer posternas konton. Saknas kontot väljer en administratör ägare under Frågelådan.
  INSERT INTO question_boxes (slug, title, description, owner_id) VALUES
    ('ubu', 'UBU, utbildningsbevakningen', 'Kurser, examination och studiemiljö.', (SELECT id FROM users WHERE email = 'ubu@statlin.se' AND active = 1)),
    ('amo', 'AMO, arbetsmiljöombudet', 'Något som inte känns okej, i studierna eller på sektionen.', (SELECT id FROM users WHERE email = 'amo@statlin.se' AND active = 1));
`,
  /* 12: STAR-sidans företag och sponsorer, och önskelistan för lunchföreläsningar. Önskemålen har inga personuppgifter. */ `
  CREATE TABLE star_companies (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    url           TEXT NOT NULL DEFAULT '',
    logo_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    description   TEXT NOT NULL DEFAULT '',
    seeks         TEXT NOT NULL DEFAULT '',                          -- mellanslagsseparerat: exjobb sommarjobb trainee heltid
    role          TEXT NOT NULL DEFAULT 'utstallare' CHECK (role IN ('utstallare','huvudsponsor','sponsor')),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    active        INTEGER NOT NULL DEFAULT 1
  );
  -- AUTOINCREMENT: ett id används aldrig två gånger, så att en gammal röst i en webbläsares localStorage inte gäller ett nytt önskemål.
  CREATE TABLE lecture_wishes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    comment    TEXT NOT NULL DEFAULT '',
    status     TEXT NOT NULL DEFAULT 'ny' CHECK (status IN ('ny','dold','onskad','pa_gang','bokad','genomford')),
    votes      INTEGER NOT NULL DEFAULT 0,
    event_id   INTEGER REFERENCES events(id) ON DELETE SET NULL,
    created_on TEXT NOT NULL                                         -- bara datumet
  );
  CREATE INDEX lecture_wishes_status ON lecture_wishes(status, votes DESC);
  `,
  /* 13: projektplanens steg är egna rader och blir uppdrag först när någon skickar dem till tavlan. Uppdrag som redan hör till en plan blir skickade steg. */
  `
  CREATE TABLE plan_steps (
    id          INTEGER PRIMARY KEY,
    plan_id     INTEGER NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    due_date    TEXT,                                                -- YYYY-MM-DD
    task_id     INTEGER UNIQUE REFERENCES tasks(id) ON DELETE SET NULL, -- uppdraget på tavlan, NULL tills steget är skickat eller om uppdraget tas bort
    done        INTEGER NOT NULL DEFAULT 0,                          -- avbockat i planen utan uppdrag
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX plan_steps_plan ON plan_steps(plan_id, due_date);
  INSERT INTO plan_steps (plan_id, title, description, due_date, task_id)
    SELECT project_plan_id, title, COALESCE(description, ''), due_date, id FROM tasks WHERE project_plan_id IS NOT NULL ORDER BY due_date, id;
  `,
  /* 14: grundtexterna utan tankstreck. replace rör bara meningar som ingen har skrivit om. */ `
  UPDATE pages SET lead = replace(lead, 'StatLin – Statistiksektionen i Linköping – är sektionen för alla', 'StatLin, Statistiksektionen i Linköping, är sektionen för alla'), body_md = replace(body_md, 'StatLin – Statistiksektionen i Linköping – är sektionen för alla', 'StatLin, Statistiksektionen i Linköping, är sektionen för alla');
  UPDATE pages SET lead = replace(lead, 'Vi ordnar det sociala – sittningar, pubar, idrott och spelkvällar – men också', 'Vi ordnar det sociala (sittningar, pubar, idrott och spelkvällar), men också'), body_md = replace(body_md, 'Vi ordnar det sociala – sittningar, pubar, idrott och spelkvällar – men också', 'Vi ordnar det sociala (sittningar, pubar, idrott och spelkvällar), men också');
  UPDATE pages SET lead = replace(lead, 'delar samma symboler – den rödsvarta overallen', 'delar samma symboler: den rödsvarta overallen'), body_md = replace(body_md, 'delar samma symboler – den rödsvarta overallen', 'delar samma symboler: den rödsvarta overallen');
  UPDATE pages SET lead = replace(lead, 'Ingen erfarenhet krävs – bara lust.', 'Ingen erfarenhet krävs, bara lust.'), body_md = replace(body_md, 'Ingen erfarenhet krävs – bara lust.', 'Ingen erfarenhet krävs, bara lust.');
  UPDATE pages SET lead = replace(lead, 'behöver under studietiden – samlat på ett ställe.', 'behöver under studietiden, samlat på ett ställe.'), body_md = replace(body_md, 'behöver under studietiden – samlat på ett ställe.', 'behöver under studietiden, samlat på ett ställe.');
  UPDATE pages SET lead = replace(lead, 'veta inför starten – på kandidaten eller mastern.', 'veta inför starten, på kandidaten eller mastern.'), body_md = replace(body_md, 'veta inför starten – på kandidaten eller mastern.', 'veta inför starten, på kandidaten eller mastern.');
  UPDATE pages SET lead = replace(lead, '**svart overall med röda revärer** – från halsen', '**svart overall med röda revärer**, från halsen'), body_md = replace(body_md, '**svart overall med röda revärer** – från halsen', '**svart overall med röda revärer**, från halsen');
  UPDATE pages SET lead = replace(lead, 'Linköpings universitet – och hur sektionen hjälper', 'Linköpings universitet, och hur sektionen hjälper'), body_md = replace(body_md, 'Linköpings universitet – och hur sektionen hjälper', 'Linköpings universitet, och hur sektionen hjälper');
  UPDATE pages SET lead = replace(lead, 'Kontakta UBU – vi tar det vidare', 'Kontakta UBU, så tar vi det vidare'), body_md = replace(body_md, 'Kontakta UBU – vi tar det vidare', 'Kontakta UBU, så tar vi det vidare');
  UPDATE pages SET lead = replace(lead, 'vart du ska vända dig – vi hjälper dig att hitta rätt.', 'vart du ska vända dig, så hjälper vi dig att hitta rätt.'), body_md = replace(body_md, 'vart du ska vända dig – vi hjälper dig att hitta rätt.', 'vart du ska vända dig, så hjälper vi dig att hitta rätt.');
  UPDATE pages SET lead = replace(lead, 'StatLin är din sektion också – här är det viktigaste', 'StatLin är din sektion också. Här är det viktigaste'), body_md = replace(body_md, 'StatLin är din sektion också – här är det viktigaste', 'StatLin är din sektion också. Här är det viktigaste');
  UPDATE pages SET lead = replace(lead, '**Engagera dig** i ett utskott – fester, idrott', '**Engagera dig** i ett utskott: fester, idrott'), body_md = replace(body_md, '**Engagera dig** i ett utskott – fester, idrott', '**Engagera dig** i ett utskott: fester, idrott');
  UPDATE pages SET lead = replace(lead, 'examination eller studiemiljö – de behandlar det konfidentiellt.', 'examination eller studiemiljö. De behandlar det konfidentiellt.'), body_md = replace(body_md, 'examination eller studiemiljö – de behandlar det konfidentiellt.', 'examination eller studiemiljö. De behandlar det konfidentiellt.');
  UPDATE pages SET lead = replace(lead, 'statistik- och data-studenter – framtidens analytiker', 'statistik- och data-studenter, framtidens analytiker'), body_md = replace(body_md, 'statistik- och data-studenter – framtidens analytiker', 'statistik- och data-studenter, framtidens analytiker');
  UPDATE pages SET lead = replace(lead, 'Vi är en liten sektion – vilket betyder att', 'Vi är en liten sektion, vilket betyder att'), body_md = replace(body_md, 'Vi är en liten sektion – vilket betyder att', 'Vi är en liten sektion, vilket betyder att');
  UPDATE pages SET lead = replace(lead, '**STAR – StatLins arbetsmarknadsdag.**', '**STAR, StatLins arbetsmarknadsdag.**'), body_md = replace(body_md, '**STAR – StatLins arbetsmarknadsdag.**', '**STAR, StatLins arbetsmarknadsdag.**');
  UPDATE pages SET lead = replace(lead, 'Linköping University – on the bachelor''s', 'Linköping University, on the bachelor''s'), body_md = replace(body_md, 'Linköping University – on the bachelor''s', 'Linköping University, on the bachelor''s');
  UPDATE pages SET lead = replace(lead, 'StatLin – *Statistiksektionen i Linköping* – is run entirely', 'StatLin (*Statistiksektionen i Linköping*) is run entirely'), body_md = replace(body_md, 'StatLin – *Statistiksektionen i Linköping* – is run entirely', 'StatLin (*Statistiksektionen i Linköping*) is run entirely');
  UPDATE pages SET lead = replace(lead, 'just ask the organisers – most of us are happy', 'just ask the organisers. Most of us are happy'), body_md = replace(body_md, 'just ask the organisers – most of us are happy', 'just ask the organisers. Most of us are happy');
  UPDATE pages SET lead = replace(lead, 'StatLin is your student association too – here is how', 'StatLin is your student association too. Here is how'), body_md = replace(body_md, 'StatLin is your student association too – here is how', 'StatLin is your student association too. Here is how');
  UPDATE pages SET lead = replace(lead, 'organise things yourself – parties, sports', 'organise things yourself: parties, sports'), body_md = replace(body_md, 'organise things yourself – parties, sports', 'organise things yourself: parties, sports');
  UPDATE pages SET lead = replace(lead, 'your study environment – they treat it confidentially.', 'your study environment. They treat it confidentially.'), body_md = replace(body_md, 'your study environment – they treat it confidentially.', 'your study environment. They treat it confidentially.');
  UPDATE committees SET tagline = replace(tagline, 'kåren och näringslivet – och ser till att', 'kåren och näringslivet, och ser till att'), description_md = replace(description_md, 'kåren och näringslivet – och ser till att', 'kåren och näringslivet, och ser till att');
  UPDATE committees SET tagline = replace(tagline, 'Trädet i vår logga – fem grenar som förgrenar sig i många små – står för', 'Trädet i vår logga, fem grenar som förgrenar sig i många små, står för'), description_md = replace(description_md, 'Trädet i vår logga – fem grenar som förgrenar sig i många små – står för', 'Trädet i vår logga, fem grenar som förgrenar sig i många små, står för');
  UPDATE committees SET tagline = replace(tagline, 'case-kvällar och företagsbesök – och tillsammans', 'case-kvällar och företagsbesök, och tillsammans'), description_md = replace(description_md, 'case-kvällar och företagsbesök – och tillsammans', 'case-kvällar och företagsbesök, och tillsammans');
  UPDATE committees SET tagline = replace(tagline, 'Sektionsmästeriet – sittningar, fester och gemenskap.', 'Sektionsmästeriet: sittningar, fester och gemenskap.'), description_md = replace(description_md, 'Sektionsmästeriet – sittningar, fester och gemenskap.', 'Sektionsmästeriet: sittningar, fester och gemenskap.');
  UPDATE committees SET tagline = replace(tagline, 'StatPub håller i sektionens pubverksamhet – från lugna', 'StatPub håller i sektionens pubverksamhet, från lugna'), description_md = replace(description_md, 'StatPub håller i sektionens pubverksamhet – från lugna', 'StatPub håller i sektionens pubverksamhet, från lugna');
  UPDATE committees SET tagline = replace(tagline, 'Ingen förkunskap krävs – det viktiga är att det är kul.', 'Ingen förkunskap krävs, det viktiga är att det är kul.'), description_md = replace(description_md, 'Ingen förkunskap krävs – det viktiga är att det är kul.', 'Ingen förkunskap krävs, det viktiga är att det är kul.');
  UPDATE committees SET tagline = replace(tagline, 'turneringar och spelkvällar – från tävlingsinriktat', 'turneringar och spelkvällar, från tävlingsinriktat'), description_md = replace(description_md, 'turneringar och spelkvällar – från tävlingsinriktat', 'turneringar och spelkvällar, från tävlingsinriktat');
  UPDATE committees SET tagline = replace(tagline, 'Studiemiljö och trivsel – för alla.', 'Studiemiljö och trivsel för alla.'), description_md = replace(description_md, 'Studiemiljö och trivsel – för alla.', 'Studiemiljö och trivsel för alla.');
  UPDATE committees SET tagline = replace(tagline, 'Hör av dig – vi behandlar det konfidentiellt.', 'Hör av dig, vi behandlar det konfidentiellt.'), description_md = replace(description_md, 'Hör av dig – vi behandlar det konfidentiellt.', 'Hör av dig, vi behandlar det konfidentiellt.');
  UPDATE links SET label = replace(label, 'Betyg per tentatillfälle – sök på kurskod', 'Betyg per tentatillfälle, sök på kurskod'), description = replace(description, 'Betyg per tentatillfälle – sök på kurskod', 'Betyg per tentatillfälle, sök på kurskod');
  UPDATE links SET label = replace(label, 'UBU – studiebevakning', 'UBU: studiebevakning'), description = replace(description, 'UBU – studiebevakning', 'UBU: studiebevakning');
  UPDATE settings SET value = replace(value, 'kontakt med arbetslivet – drivet av studenter, för studenter.', 'kontakt med arbetslivet. Drivet av studenter, för studenter.');
  UPDATE committees SET description_md = replace(description_md, 'Hör av dig – du kan alltid vara anonym.', 'Hör av dig, du kan alltid vara anonym.');
  UPDATE pages SET body_md = replace(body_md, 'examination eller studiemiljö – anonymt om du vill.', 'examination eller studiemiljö, anonymt om du vill.');
  UPDATE pages SET body_md = replace(body_md, 'your study environment – anonymously if you prefer.', 'your study environment, anonymously if you prefer.');
  UPDATE wheel_items SET title = replace(title, 'STAR – arbetsmarknadsdagen', 'STAR, arbetsmarknadsdagen');
  `,
  /* 15: Intresseanmälan till STAR från företag som fått inbjudningslänken, och koden som gör länken privat. */
  `
  CREATE TABLE star_intresse (
    id INTEGER PRIMARY KEY,
    foretag TEXT NOT NULL,
    kontakt_namn TEXT NOT NULL,
    epost TEXT NOT NULL,
    telefon TEXT NOT NULL DEFAULT '',
    val TEXT NOT NULL DEFAULT 'med' CHECK (val IN ('med','mer')),
    vill_boka_mote INTEGER NOT NULL DEFAULT 0,
    moteforslag TEXT NOT NULL DEFAULT '',
    meddelande TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ny' CHECK (status IN ('ny','hanterad')),
    mejl_status TEXT NOT NULL DEFAULT 'vantar' CHECK (mejl_status IN ('vantar','skickat','misslyckades','ej_installt')),
    created_at TEXT NOT NULL
  );
  CREATE INDEX star_intresse_status ON star_intresse(status, created_at);
  INSERT OR IGNORE INTO settings (key, value) VALUES ('star_inbjudan_kod', lower(hex(randomblob(12))));
  UPDATE pages SET lead = 'Möt Linköpings blivande statistiker, analytiker och data scientists innan de har bestämt sig för var de vill jobba.' WHERE slug = 'foretag' AND lead = 'Nå Linköpings statistik- och data-studenter, framtidens analytiker, data scientists och statistiker.';
  UPDATE pages SET body_md = '## Det här kan vi göra tillsammans

- **STAR, StatLins arbetsmarknadsdag.** Sektionens största arbetsmarknadsevenemang.
- **Lunchföreläsningar och case-kvällar** där studenterna får prova på era verkliga problem.
- **Exjobb, praktik och sommarjobb** som vi sprider i våra kanaler.
- **Profilkläder.** Sponsorloggor kan tryckas längs ärmarna på styrelsens och mästeriets hoodies.' WHERE slug = 'foretag' AND body_md = '## Varför StatLin?

Våra medlemmar läser statistik, programmering och maskininlärning och möter arbetslivet med både teoretiskt djup och praktisk erfarenhet av riktiga data. Vi är en liten sektion, vilket betyder att ni når rätt personer, inte en anonym massa.

## Det här kan vi göra tillsammans

- **STAR, StatLins arbetsmarknadsdag.** Sektionens största arbetsmarknadsevenemang.
- **Lunchföreläsningar och case-kvällar** där studenterna får prova på era verkliga problem.
- **Exjobb, praktik och sommarjobb** som vi sprider i våra kanaler.
- **Profilkläder.** Sponsorloggor kan tryckas längs ärmarna på styrelsens och mästeriets hoodies.

## Kontakt

Hör av er till vår näringslivsansvariga i SASU så tar vi fram ett upplägg som passar er.';
  `,
  /* 16: demodatan som redan ligger i en databas får samma text som scripts/seed.ts, utan tankstreck. replace rör bara meningar som ingen har skrivit om. */ `
  UPDATE events SET title = replace(title, 'STAR – StatLins Arbetsmarknadsdag', 'STAR, StatLins arbetsmarknadsdag');
  UPDATE events SET summary = replace(summary, 'Ta med datorn – eSTIG fixar nätverk, el och turneringsschema.', 'Ta med datorn, eSTIG fixar nätverk, el och turneringsschema.');
  UPDATE events SET summary = replace(summary, 'Tyck till om höstens kurser – UBU bjuder på fika.', 'Tyck till om höstens kurser. UBU bjuder på fika.');
  UPDATE events SET summary = replace(summary, 'Terminens sista sittning – med julbord, tomtar och snapsvisor.', 'Terminens sista sittning, med julbord, tomtar och snapsvisor.');
  UPDATE events SET summary = replace(summary, 'Mottagningens höjdpunkt – bilder från kvällen finns i galleriet.', 'Mottagningens höjdpunkt. Bilder från kvällen finns i galleriet.');
  UPDATE events SET body_md = replace(body_md, 'från notebook till produktion – och vad de letar efter', 'från notebook till produktion, och vad de letar efter');
  UPDATE events SET body_md = replace(body_md, 'Kom tidigt – de bästa borden går fort.', 'Kom tidigt, de bästa borden går fort.');
  UPDATE news SET excerpt = replace(excerpt, 'Höstsittning och julsittning – boka in datumen redan nu.', 'Höstsittning och julsittning: boka in datumen redan nu.');
  UPDATE news SET body_md = replace(body_md, 'styrelsen och utskotten – och du kan prenumerera', 'styrelsen och utskotten, och du kan prenumerera');
  UPDATE news SET body_md = replace(body_md, 'Det du skriver läses – och leder till förändring.', 'Det du skriver läses och leder till förändring.');
  UPDATE committees SET tagline = replace(tagline, 'Trädet i loggan – fem grenar som förgrenar sig i många små – står för', 'Trädet i loggan, fem grenar som förgrenar sig i många små, står för'), description_md = replace(description_md, 'Trädet i loggan – fem grenar som förgrenar sig i många små – står för', 'Trädet i loggan, fem grenar som förgrenar sig i många små, står för');
  `,
  /* 17: varje utskott kan få en önskelåda på sin sida. Den är av tills utskottet slår på den, och id:t slumpas som i frågelådan. */ `
  ALTER TABLE committees ADD COLUMN wishes_open INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE committee_wishes (
    id INTEGER PRIMARY KEY,
    committee_id INTEGER NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    month TEXT NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0,
    handled INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX committee_wishes_committee ON committee_wishes(committee_id, seen);
  `,
  /* 18: styrelsemöten och deras dagordning. Punkterna är mallens, ordförandens eller förslag som väntar på beslut (status). */ `
  CREATE TABLE meetings (
    id INTEGER PRIMARY KEY,
    starts_at TEXT NOT NULL,
    place TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX meetings_starts_at ON meetings(starts_at);
  CREATE TABLE meeting_items (
    id INTEGER PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    proposed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'agenda', 'declined')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX meeting_items_meeting ON meeting_items(meeting_id, status, sort_order);
  `,
  /* 19: eSTIG:s sida tar emot spelönskemål i önskelådan, så den slås på för eSTIG. Utskottet kan stänga den igen. */ `
  UPDATE committees SET wishes_open = 1 WHERE slug = 'estig';
  `,
  /* 20: Fem standardtexter fick en bit _för hand_ (accent-text.tsx). Sparade texter som är exakt den gamla standardtexten får den
     nya, så att de syns på sajten. Texter som någon har ändrat står kvar. */ `
  UPDATE settings SET value = 'Sittningar, pubar, idrott, studiebevakning och kontakt med arbetslivet.' || char(10) || '_Drivet av studenter, för studenter._'
    WHERE key = 'hero_text' AND value = 'Sittningar, pubar, idrott, studiebevakning och kontakt med arbetslivet. Drivet av studenter, för studenter.';
  UPDATE settings SET value = '_Utskotten är hjärtat i sektionen._ Varje utskott har sin egen logga, alla byggda på samma baslogotyp men med sin egen bakgrundsgrafik.'
    WHERE key = 'text_utskott_ingress' AND value = 'Utskotten är hjärtat i sektionen. Varje utskott har sin egen logga, alla byggda på samma baslogotyp men med sin egen bakgrundsgrafik.';
  UPDATE settings SET value = 'Alla utskott söker folk, _*ingen erfarenhet krävs.*_'
    WHERE key = 'text_start_engagera_text' AND value = 'Alla utskott söker folk, ingen erfarenhet krävs.';
  UPDATE settings SET value = 'Sittningar, pubar, idrott, föreläsningar och sektionsmöten. Prenumerera på kalendern så _missar du inget._'
    WHERE key = 'text_evenemang_ingress' AND value = 'Sittningar, pubar, idrott, föreläsningar och sektionsmöten. Prenumerera på kalendern så missar du inget.';
  UPDATE settings SET value = '_Hur brukar tentan gå?_ Sök på kurskoden, för vilken LiU-kurs som helst, och se betygen på varje tentatillfälle.'
    WHERE key = 'text_tentastatistik_ingress' AND value = 'Hur brukar tentan gå? Sök på kurskoden, för vilken LiU-kurs som helst, och se betygen på varje tentatillfälle.';
  `,
];

export function migrate(db: Database.Database) {
  const current = db.pragma("user_version", { simple: true }) as number;
  // En nyare version av koden har migrerat databasen. Den här koden känner inte till tabellerna och
  // kolumnerna som tillkommit, så den vägrar i stället för att fela först i en action eller på en sida.
  if (current > steps.length) {
    throw new Error(
      `[statlin] Databasen har user_version ${current}, men koden känner bara till ${steps.length} migreringssteg: ` +
        "databasen är nyare än koden – återställ ögonblicksbilden från före uppgraderingen eller deploya en nyare version " +
        "(README → Överlämning → Återställning och rollback).",
    );
  }
  if (current >= steps.length) return;
  const run = db.transaction(() => {
    for (let v = current; v < steps.length; v++) {
      db.exec(steps[v]);
    }
    db.pragma(`user_version = ${steps.length}`);
  });
  run();
}
