import "server-only";
import { planIdOf } from "@/lib/chatt";
import type { SessionUser } from "@/lib/types";
import { listChannelSummaries } from "./chatt";
import { readDb } from "./db";
import { countUnseenQuestions } from "./fragelada";
import { canManageNaringsliv, countNewInterest, countNewWishes } from "./naringsliv";
import { countNewCommitteeWishes } from "./onskelada";

/**
 * Det som har hänt sedan kontot senast tittade: nytt i planernas trådar, inbjudningar till planer, nya uppdrag och det som kommit in
 * från sajten. Aviseringarna sparas inte för sig. De räknas fram ur det som redan finns (läsmärken, seen_at, tasks_seen_at och
 * lådornas egna markeringar), så en avisering försvinner av sig själv när kontot har öppnat det den gäller.
 */
export type Avisering = {
  key: string;
  slag: "trad" | "inbjudan" | "uppdrag" | "forfragan";
  title: string;
  text: string;
  href: string;
  /** När det hände. Null för det som bara räknas, som frågorna i en låda. */
  at: string | null;
  /** Hur många det gäller: olästa meddelanden, nya uppdrag, nya frågor. */
  count: number;
};

const few = (titles: string[]) => (titles.length <= 2 ? titles.join(" och ") : `${titles[0]}, ${titles[1]} och ${titles.length - 2} till`);

export async function listAviseringar(user: SessionUser): Promise<Avisering[]> {
  const naringsliv = canManageNaringsliv(user);
  const ownCommittee = user.role === "committee" && user.committee_kind !== "styrelse" ? user.committee_id : null;
  const [db, threads, questions, ownWishes, interest, wishes] = await Promise.all([
    readDb(),
    listChannelSummaries(user),
    countUnseenQuestions(user.id),
    countNewCommitteeWishes(ownCommittee),
    naringsliv ? countNewInterest() : 0,
    naringsliv ? countNewWishes() : 0,
  ]);
  const dated: Avisering[] = [];

  for (const t of threads) {
    if (t.unread === 0 || !t.last) continue;
    const who = t.last.author_id === user.id ? "Du" : (t.last.author_name?.split(" ")[0] ?? "Borttaget konto");
    dated.push({
      key: `trad-${t.key}`,
      slag: "trad",
      title: t.name,
      text: t.last.deleted ? "Meddelandet togs bort" : `${who}: ${t.last.body}`,
      href: `/admin/projektplaner/${planIdOf(t.key)}#trad`,
      at: t.last.created_at,
      count: t.unread,
    });
  }

  const invites = db
    .prepare("SELECT p.id, p.title, k.added_at FROM plan_collaborators k JOIN project_plans p ON p.id = k.plan_id WHERE k.user_id = ? AND k.seen_at IS NULL ORDER BY k.added_at DESC")
    .all(user.id) as { id: number; title: string; added_at: string }[];
  for (const p of invites) {
    dated.push({ key: `inbjudan-${p.id}`, slag: "inbjudan", title: `Du är med i planen ${p.title}`, text: "Du har bjudits in som medarbetare och kan fråga och svara i planens tråd.", href: `/admin/projektplaner/${p.id}`, at: p.added_at, count: 1 });
  }

  // Samma urval som siffran vid Uppdragstavla (countUnseenTasks). Raden leder till tavlan, där uppdragen räknas som sedda.
  const tasks = db
    .prepare(
      `SELECT t.title, t.assigned_at, COALESCE(NULLIF(u.post, ''), u.name) AS sender, COALESCE(e.title, pp.title) AS context
       FROM tasks t LEFT JOIN users u ON u.id = t.from_user_id LEFT JOIN events e ON e.id = t.event_id LEFT JOIN project_plans pp ON pp.id = t.project_plan_id
       WHERE t.to_user_id = ? AND t.status != 'klar' AND t.assigned_at IS NOT NULL
         AND t.assigned_at > COALESCE((SELECT tasks_seen_at FROM users WHERE id = ?), '')
       ORDER BY t.assigned_at DESC`,
    )
    .all(user.id, user.id) as { title: string; assigned_at: string; sender: string | null; context: string | null }[];
  if (tasks.length > 0) {
    const [first] = tasks;
    dated.push({
      key: "uppdrag",
      slag: "uppdrag",
      title: tasks.length === 1 ? `Nytt uppdrag: ${first.title}` : `${tasks.length} nya uppdrag till dig`,
      text: tasks.length === 1 ? [first.sender && `Från ${first.sender}`, first.context].filter(Boolean).join(" · ") : few(tasks.map((t) => t.title)),
      href: "/admin/uppdrag?visa=till",
      at: first.assigned_at,
      count: tasks.length,
    });
  }
  dated.sort((a, b) => (a.at! < b.at! ? 1 : -1));

  const counted: Avisering[] = [];
  const request = (key: string, n: number, title: string, one: string, many: string, href: string) => {
    if (n > 0) counted.push({ key, slag: "forfragan", title, text: n === 1 ? one : `${n} ${many}`, href, at: null, count: n });
  };
  request("fragor", questions, "Frågelådan", "1 ny fråga", "nya frågor", "/admin/fragelada");
  request("onskelada", ownWishes, "Önskelådan", "1 nytt önskemål, skickat anonymt via er sida", "nya önskemål, skickade anonymt via er sida", `/admin/utskott/${ownCommittee}`);
  request("intresse", interest, "Intresseanmälningar till STAR", "1 företag väntar på svar", "företag väntar på svar", "/admin/intresseanmalningar");
  request("lunch", wishes, "Lunchönskemål", "1 nytt önskemål att godkänna", "nya önskemål att godkänna", "/admin/lunchonskemal");
  return [...dated, ...counted];
}
