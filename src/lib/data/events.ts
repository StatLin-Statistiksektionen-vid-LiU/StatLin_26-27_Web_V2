import "server-only";
import { parseCommitteeRef, readDb } from "./db";
import { canFormatLocal, nowLocal } from "@/lib/dates";
import { MEDIA_JSON_COLUMNS, parseMediaJson, toImageRef } from "@/lib/media-url";
import type { EventImage, EventItem, ImageRef, Media } from "@/lib/types";

type Row = Omit<EventItem, "committee" | "cover" | "published" | "all_day"> & { published: number; all_day: number; committee_json: string | null; cover_json: string | null };

const SELECT = `
  SELECT e.*,
    CASE WHEN c.id IS NULL THEN NULL ELSE json_object(
      'id', c.id, 'slug', c.slug, 'name', c.name, 'short_name', c.short_name, 'logo_url', c.logo_url, 'accent', c.accent, 'visible', c.visible, 'kind', c.kind
    ) END AS committee_json,
    ${MEDIA_JSON_COLUMNS("m")} AS cover_json,
    (SELECT COUNT(*) FROM event_images ei WHERE ei.event_id = e.id) AS image_count
  FROM events e
  LEFT JOIN committees c ON c.id = e.committee_id
  LEFT JOIN media m ON m.id = e.cover_media_id`;

function map(r: Row): EventItem {
  const { committee_json, cover_json, ...rest } = r;
  return {
    ...rest,
    published: Boolean(r.published),
    all_day: Boolean(r.all_day),
    committee: parseCommitteeRef(committee_json),
    cover: toImageRef(parseMediaJson(cover_json)),
  };
}

/**
 * Rader från före SB-32 kan ha ett datum som inte går att visa, och ett kort med "NaN" eller en trasig kalenderfil hjälper ingen.
 * Sajten visar dem inte. Adminpanelen läser dem som vanligt, så att de går att rätta där.
 */
function canShow(r: Pick<Row, "id" | "starts_at" | "ends_at">): boolean {
  if (canFormatLocal(r.starts_at) && (r.ends_at === null || canFormatLocal(r.ends_at))) return true;
  console.error(`[statlin] Evenemang ${r.id} har ett ogiltigt datum och visas inte på sajten. Rätta det i adminpanelen.`);
  return false;
}

const mapShown = (rows: Row[]) => rows.filter(canShow).map(map);

/** Sista minuten ett evenemang pågår – samma regel som eventEnd i src/lib/dates.ts. */
export const EVENT_END = `CASE WHEN e.all_day = 1 THEN substr(COALESCE(e.ends_at, e.starts_at), 1, 10) || 'T23:59'
  ELSE COALESCE(e.ends_at, substr(e.starts_at, 1, 10) || 'T23:59') END`;

/** Kommande = ej avslutade (pågående räknas som kommande). */
export async function listUpcomingEvents(limit = 50, committeeId?: number): Promise<EventItem[]> {
  const db = await readDb();
  const now = nowLocal();
  const rows = db
    .prepare(
      `${SELECT}
       WHERE e.published = 1 AND ${EVENT_END} >= @now
       ${committeeId ? "AND e.committee_id = @committeeId" : ""}
       ORDER BY e.starts_at ASC LIMIT @limit`,
    )
    .all({ now, limit, committeeId: committeeId ?? null }) as Row[];
  return mapShown(rows);
}

export async function listPastEvents(limit = 24, committeeId?: number): Promise<EventItem[]> {
  const db = await readDb();
  const now = nowLocal();
  const rows = db
    .prepare(
      `${SELECT}
       WHERE e.published = 1 AND ${EVENT_END} < @now
       ${committeeId ? "AND e.committee_id = @committeeId" : ""}
       ORDER BY e.starts_at DESC LIMIT @limit`,
    )
    .all({ now, limit, committeeId: committeeId ?? null }) as Row[];
  return mapShown(rows);
}

/** Evenemang som pågår någon gång från fromDate till toDate, båda minuterna inräknade. */
export async function listEventsBetween(fromDate: string, toDate: string): Promise<EventItem[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `${SELECT}
       WHERE e.published = 1 AND e.starts_at <= @to AND COALESCE(e.ends_at, e.starts_at) >= @from
       ORDER BY e.starts_at ASC`,
    )
    .all({ from: fromDate, to: toDate }) as Row[];
  return mapShown(rows);
}

export async function listAllPublishedEvents(): Promise<EventItem[]> {
  const db = await readDb();
  return mapShown(db.prepare(`${SELECT} WHERE e.published = 1 ORDER BY e.starts_at DESC`).all() as Row[]);
}

/**
 * STAR-mässans kommande evenemang, oberoende av hur många som ligger före: det som valts i Inställningar, annars nästa med
 * adressen star eller star-<år>. Mönstret är strikt, så att starta-terminen och hostarsmote inte räknas som mässan.
 */
export async function getStarEvent(chosenId: number | null): Promise<EventItem | null> {
  const db = await readDb();
  const row = db
    .prepare(
      `${SELECT}
       WHERE e.published = 1 AND ${EVENT_END} >= @now
         AND (e.id = @chosenId OR e.slug = 'star' OR e.slug GLOB 'star-[0-9][0-9][0-9][0-9]')
       ORDER BY e.id = @chosenId DESC, e.starts_at ASC LIMIT 1`,
    )
    .get({ now: nowLocal(), chosenId }) as Row | undefined;
  return row && canShow(row) ? map(row) : null;
}

/** Kommande lunchföreläsningar. Samma regel som isLunchEvent i src/lib/naringsliv.ts: titeln eller adressen säger det. */
export async function listLunchEvents(limit = 5): Promise<EventItem[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `${SELECT}
       WHERE e.published = 1 AND ${EVENT_END} >= @now AND (e.title LIKE 'Lunchföreläsning%' OR e.slug LIKE 'lunch%')
       ORDER BY e.starts_at ASC LIMIT @limit`,
    )
    .all({ now: nowLocal(), limit }) as Row[];
  return mapShown(rows);
}

export async function getEventBySlug(slug: string, includeDrafts = false): Promise<EventItem | null> {
  const db = await readDb();
  const row = db
    .prepare(`${SELECT} WHERE e.slug = ? ${includeDrafts ? "" : "AND e.published = 1"}`)
    .get(slug) as Row | undefined;
  return row && canShow(row) ? map(row) : null;
}

export async function getEventById(id: number): Promise<EventItem | null> {
  const db = await readDb();
  const row = db.prepare(`${SELECT} WHERE e.id = ?`).get(id) as Row | undefined;
  return row ? map(row) : null;
}

/**
 * Utan since: alla evenemang, senast först. Med since: de som inte är slut vid den tiden (pågående räknas), tidigast först.
 * Adminöversikten väljer och begränsar här, så att den inte läser hela historiken för att visa fem rader.
 */
export async function listEventsForAdmin(committeeId: number | null, opts: { since?: string; limit?: number } = {}): Promise<EventItem[]> {
  const db = await readDb();
  const { since, limit = -1 } = opts;
  const where = [committeeId ? "e.committee_id = @committeeId" : "", since ? `${EVENT_END} >= @since` : ""].filter(Boolean).join(" AND ");
  const rows = db
    .prepare(`${SELECT} ${where ? `WHERE ${where}` : ""} ORDER BY e.starts_at ${since ? "ASC" : "DESC"} LIMIT @limit`)
    .all({ committeeId, since: since ?? null, limit }) as Row[];
  return rows.map(map);
}

/** Publicerade evenemang som är slut och saknar bilder, senast först. committeeId null gäller hela sajten. */
export async function listPastEventsWithoutImages(committeeId: number | null, limit: number): Promise<EventItem[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `${SELECT}
       WHERE e.published = 1 AND ${EVENT_END} < @now
         AND NOT EXISTS (SELECT 1 FROM event_images ei WHERE ei.event_id = e.id)
         ${committeeId ? "AND e.committee_id = @committeeId" : ""}
       ORDER BY e.starts_at DESC LIMIT @limit`,
    )
    .all({ now: nowLocal(), committeeId, limit }) as Row[];
  return rows.map(map);
}

/** Evenemang som ingen granskat, senast ändrade först. */
export async function listEventsToReview(): Promise<EventItem[]> {
  const db = await readDb();
  const rows = db.prepare(`${SELECT} WHERE e.checked_at IS NULL ORDER BY e.updated_at DESC, e.starts_at DESC`).all() as Row[];
  return rows.map(map);
}

export async function listEventImages(eventId: number): Promise<EventImage[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `SELECT ei.id, ei.event_id, ei.caption, ei.sort_order, ${MEDIA_JSON_COLUMNS("m")} AS media_json
       FROM event_images ei JOIN media m ON m.id = ei.media_id
       WHERE ei.event_id = ? ORDER BY ei.sort_order, ei.id`,
    )
    .all(eventId) as (Omit<EventImage, "image"> & { media_json: string })[];
  return rows.flatMap(({ media_json, ...r }) => {
    const image = toImageRef(parseMediaJson(media_json));
    return image ? [{ ...r, image }] : [];
  });
}

export interface CommitteeImage {
  id: number;
  caption: string;
  image: ImageRef;
  event: { slug: string; title: string; starts_at: string };
}

/** Bilder från utskottets evenemang till utskottets sida: högst tre per evenemang, det senaste evenemanget först. */
export async function listCommitteeImages(committeeId: number, limit: number): Promise<CommitteeImage[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT ei.id, ei.caption, e.slug, e.title, e.starts_at, ${MEDIA_JSON_COLUMNS("m")} AS media_json,
           ROW_NUMBER() OVER (PARTITION BY ei.event_id ORDER BY ei.sort_order, ei.id) AS n
         FROM event_images ei JOIN events e ON e.id = ei.event_id JOIN media m ON m.id = ei.media_id
         WHERE e.committee_id = ? AND e.published = 1
       ) WHERE n <= 3 ORDER BY starts_at DESC, n LIMIT ?`,
    )
    .all(committeeId, limit) as { id: number; caption: string; slug: string; title: string; starts_at: string; media_json: string }[];
  return rows.flatMap(({ media_json, id, caption, ...event }) => {
    const image = toImageRef(parseMediaJson(media_json));
    return image && canFormatLocal(event.starts_at) ? [{ id, caption, image, event }] : [];
  });
}

export interface GalleryAlbum {
  event: EventItem;
  preview: EventImage["image"][];
}

export async function listGalleryAlbums(): Promise<GalleryAlbum[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `WITH numbered AS (
         SELECT ei.event_id, ${MEDIA_JSON_COLUMNS("m")} AS media_json,
           ROW_NUMBER() OVER (PARTITION BY ei.event_id ORDER BY ei.sort_order, ei.id) AS n
         FROM event_images ei JOIN media m ON m.id = ei.media_id
       ), preview AS (
         SELECT event_id, json_group_array(json(media_json) ORDER BY n) AS preview_json
         FROM numbered WHERE n <= 4 GROUP BY event_id
       )
       SELECT album.*, preview.preview_json
       FROM (${SELECT} WHERE e.published = 1) album
       JOIN preview ON preview.event_id = album.id
       ORDER BY album.starts_at DESC`,
    )
    .all() as (Row & { preview_json: string })[];
  return rows.filter(canShow).map(({ preview_json, ...row }) => ({
    event: map(row),
    preview: (JSON.parse(preview_json) as Media[]).map((m) => toImageRef(m)!).filter(Boolean),
  }));
}
