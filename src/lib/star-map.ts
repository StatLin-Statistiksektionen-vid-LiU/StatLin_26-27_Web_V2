/**
 * Stjärnkartans placering. Varje företag får sin plats ur en slumpföljd som bara beror på dess id, och företagen placeras i
 * id-ordning. Bilden är därför densamma mellan besök, och ett nytt företag flyttar inga av de gamla stjärnorna.
 */
import { mulberry32 } from "./utils";

export type MapInput = { id: number; name: string };
export type MapStar = { id: number; x: number; y: number; label: string; anchor: "start" | "end" };
export type StarMap = { width: number; height: number; stars: MapStar[]; lines: [number, number][] };

const LABEL_MAX = 30;
const CHAR_WIDTH = 7.6;
const MARGIN_X = 28;
const MARGIN_Y = 34;

/** Långa namn kortas på kartan. Hela namnet står på kortet. */
export const mapLabel = (name: string) => (name.length > LABEL_MAX ? `${name.slice(0, LABEL_MAX - 1).trimEnd()}…` : name);

type Box = { left: number; right: number; top: number; bottom: number };
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Minsta uppspännande trädet (Prim): kortaste linjerna som binder ihop alla stjärnor, och det är så stjärnbilder brukar se ut. */
function spanningLines(stars: MapStar[]): [number, number][] {
  if (stars.length < 2) return [];
  const lines: [number, number][] = [];
  const reached = new Set([0]);
  while (reached.size < stars.length) {
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    for (const from of reached) {
      for (let to = 0; to < stars.length; to++) {
        if (reached.has(to)) continue;
        const dist = (stars[from].x - stars[to].x) ** 2 + (stars[from].y - stars[to].y) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = [from, to];
        }
      }
    }
    lines.push(best!);
    reached.add(best![1]);
  }
  return lines;
}

/**
 * Datorn: en bred himmel där namnen står bredvid stjärnorna utan att krocka. Himlen växer med antalet företag. En smalare
 * himmel blir lika mycket högre, så att stjärnorna får lika mycket plats var.
 */
export function wideMap(companies: MapInput[], width = 1000): StarMap {
  const height = Math.round((Math.min(1100, Math.max(460, 120 + companies.length * 34)) * 1000) / width);
  const sorted = [...companies].sort((a, b) => a.id - b.id);
  const boxes: Box[] = [];
  const stars: MapStar[] = [];
  for (const c of sorted) {
    const random = mulberry32(Math.imul(c.id + 1, 2654435761) >>> 0);
    const label = mapLabel(c.name);
    const labelWidth = label.length * CHAR_WIDTH + 18;
    // Av tolv lediga platser tas den som ligger längst från de andra, så att stjärnorna sprids över hela himlen i stället för att klumpa ihop sig.
    let chosen: { star: MapStar; box: Box; room: number } | null = null;
    let free = 0;
    let fallback: { star: MapStar; box: Box; hits: number } | null = null;
    for (let attempt = 0; attempt < 400 && free < 12; attempt++) {
      const x = MARGIN_X + random() * (width - 2 * MARGIN_X);
      const y = MARGIN_Y + random() * (height - 2 * MARGIN_Y);
      // Namnet står åt det håll där det får plats, och helst in mot mitten.
      const anchor: MapStar["anchor"] = x + labelWidth > width - MARGIN_X / 2 ? "end" : x - labelWidth < MARGIN_X / 2 ? "start" : x < width / 2 ? "start" : "end";
      const box: Box = {
        left: anchor === "start" ? x - 22 : x - labelWidth - 6,
        right: anchor === "start" ? x + labelWidth + 6 : x + 22,
        top: y - 28,
        bottom: y + 28,
      };
      const hits = boxes.filter((b) => overlaps(b, box)).length;
      const star = { id: c.id, x: Math.round(x), y: Math.round(y), label, anchor };
      if (hits === 0) {
        free++;
        const room = Math.min(Infinity, ...stars.map((o) => (o.x - star.x) ** 2 + (o.y - star.y) ** 2));
        if (!chosen || room > chosen.room) chosen = { star, box, room };
      } else if (!fallback || hits < fallback.hits) fallback = { star, box, hits };
    }
    const placed = chosen ?? fallback!;
    stars.push(placed.star);
    boxes.push(placed.box);
  }
  return { width, height, stars, lines: spanningLines(stars) };
}

/** Telefonen: en stjärna per rad i sicksack, så att varje namn får en egen rad och fingret träffar rätt. */
export function narrowMap(companies: MapInput[]): StarMap {
  const width = 360;
  const rowHeight = 52;
  const sorted = [...companies].sort((a, b) => a.id - b.id);
  const stars = sorted.map((c, i) => {
    const random = mulberry32(Math.imul(c.id + 1, 2654435761) >>> 0);
    const left = i % 2 === 0;
    const x = Math.round(left ? 24 + random() * 70 : 266 + random() * 70);
    return { id: c.id, x, y: 40 + i * rowHeight, label: mapLabel(c.name), anchor: (left ? "start" : "end") as MapStar["anchor"] };
  });
  const lines = stars.slice(1).map((_, i): [number, number] => [i, i + 1]);
  return { width, height: 40 + Math.max(0, stars.length - 1) * rowHeight + 40, stars, lines };
}
