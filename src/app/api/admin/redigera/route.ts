import { json } from "@/lib/api";
import { canEditCommittee, canEditImages, canEditOwned, canManageSettings, isEditor } from "@/lib/auth/permissions";
import { getSessionUser, renewSessionIfDue } from "@/lib/auth/session";
import { getBoardMember, getCommitteeById, getPage, getSettings, listCommittees } from "@/lib/data/content";
import { getEventById, listEventImages, listUpcomingEvents } from "@/lib/data/events";
import { canManageNaringsliv } from "@/lib/data/naringsliv";
import { getNewsById } from "@/lib/data/news";
import type { SessionUser } from "@/lib/types";

const denied = () => json({ error: "Du har inte behörighet att ändra det här." }, 403);
const missing = () => json({ error: "Det finns inte längre." }, 404);

/** Utskottskonton väljer inte arrangör – de ser bara sitt eget utskott i formuläret. */
async function committeesFor(user: SessionUser) {
  const all = await listCommittees();
  return user.role === "committee" ? all.filter((c) => c.id === user.committee_id) : all;
}

/**
 * Data till redigeringspanelen på sajten. Samma behörighet som adminsidorna; själva sparningen
 * går sedan via de vanliga server actions, som kontrollerar igen.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return json({ error: "Du är inte inloggad." }, 401);
  if (user.must_change_password) return json({ error: "Byt ditt tillfälliga lösenord i adminpanelen först." }, 403);
  await renewSessionIfDue();

  const params = new URL(request.url).searchParams;
  const id = Number(params.get("id"));

  switch (params.get("typ")) {
    case "page": {
      if (!isEditor(user)) return denied();
      const page = await getPage(params.get("slug") ?? "");
      return page ? json({ page }) : missing();
    }
    case "home":
    case "footer":
    case "contact":
    case "texts": {
      if (!canManageSettings(user)) return denied();
      return json({ settings: await getSettings() });
    }
    case "star": {
      if (!canManageNaringsliv(user)) return denied();
      return json({ settings: await getSettings(), events: await listUpcomingEvents(200) });
    }
    case "committee": {
      if (!canEditCommittee(user, id)) return denied();
      const committee = await getCommitteeById(id);
      return committee ? json({ committee, editor: isEditor(user) }) : missing();
    }
    case "event": {
      const event = await getEventById(id);
      if (!event) return missing();
      if (!canEditOwned(user, event)) return denied();
      return json({ event, committees: await committeesFor(user), user: { role: user.role, committee_id: user.committee_id } });
    }
    case "news": {
      const item = await getNewsById(id);
      if (!item) return missing();
      if (!canEditOwned(user, item)) return denied();
      return json({ item, committees: await committeesFor(user), user: { role: user.role, committee_id: user.committee_id } });
    }
    case "event-images": {
      const event = await getEventById(id);
      if (!event) return missing();
      if (!canEditImages(user, event)) return denied();
      const images = await listEventImages(event.id);
      return json({ cover: event.cover, images: images.map((i) => ({ id: i.id, caption: i.caption, image: i.image })) });
    }
    case "news-cover": {
      const item = await getNewsById(id);
      if (!item) return missing();
      if (!canEditImages(user, item)) return denied();
      return json({ cover: item.cover });
    }
    case "board": {
      if (!isEditor(user)) return denied();
      const member = await getBoardMember(id);
      if (!member) return missing();
      const committees = (await listCommittees()).map((c) => ({ id: c.id, short_name: c.short_name }));
      return json({ member, committees });
    }
    default:
      return json({ error: "Okänd typ." }, 400);
  }
}
