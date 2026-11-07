import { getSessionUser } from "@/lib/auth/session";
import { canManageNaringsliv } from "@/lib/data/naringsliv";
import { canManageEstig, canManageUbu } from "@/lib/data/utskott-behorighet";
import { AdminBarLazy } from "./admin-bar-lazy";

/** Läser sessionen i ett eget Suspense-hål, så att sidorna förblir statiska för besökare. Koden för bubblan hämtas bara för inloggade, se admin-bar-lazy.tsx. */
export async function AdminBarLoader() {
  const user = await getSessionUser();
  if (!user) return null;
  return <AdminBarLazy user={{ id: user.id, name: user.name, post: user.post, role: user.role, committee_id: user.committee_id, committee_name: user.committee_name, design: user.design, naringsliv: canManageNaringsliv(user), ubu: canManageUbu(user), estig: canManageEstig(user) }} />;
}
