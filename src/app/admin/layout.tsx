import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Notice } from "@/components/admin/ui";
import { canManageFragelada } from "@/lib/auth/permissions";
import { getSessionUser, loginPath, sessionExpiresSoon } from "@/lib/auth/session";
import { readDb } from "@/lib/data/db";
import { countUnseenQuestions, frageladaIsOpen } from "@/lib/data/fragelada";
import { countNewCommitteeWishes } from "@/lib/data/onskelada";
import { canManageNaringsliv, countNewInterest, countNewWishes } from "@/lib/data/naringsliv";
import { countUnseenTasks } from "@/lib/data/tasks";
import { formatTimestamp } from "@/lib/dates";

export const metadata: Metadata = {
  title: { default: "Adminpanel", template: "%s · Admin · StatLin" },
  robots: { index: false, follow: false },
};

// Adminpanelen läser sessionen och får blockera vid navigering.
export const instant = false;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect(await loginPath());
  const naringsliv = canManageNaringsliv(user);
  const [unseenTasks, expiresAt, unseenQuestions, db, newWishes, newInterest, ownWishes] = await Promise.all([
    countUnseenTasks(user.id),
    sessionExpiresSoon(),
    countUnseenQuestions(user.id),
    readDb(),
    naringsliv ? countNewWishes() : 0,
    naringsliv ? countNewInterest() : 0,
    // Utskottets egen önskelåda. Styrelseposter utan eget utskott har ingen.
    countNewCommitteeWishes(user.role === "committee" && user.committee_kind !== "styrelse" ? user.committee_id : null),
  ]);
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] print:block print:bg-white">
      <AdminSidebar
        user={{
          name: user.name,
          post: user.post,
          role: user.role,
          committee_name: user.committee_name,
          committee_id: user.committee_id,
          committee_kind: user.committee_kind,
          design: user.design,
        }}
        unseenTasks={unseenTasks}
        questionBox={{ show: canManageFragelada(user) || frageladaIsOpen(db) || unseenQuestions > 0, unseen: unseenQuestions }}
        naringsliv={naringsliv}
        newWishes={newWishes}
        newInterest={newInterest}
        ownWishes={ownWishes}
      />
      <div className="min-w-0">
        {user.must_change_password && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-red px-6 py-3 text-sm font-semibold text-white">
            <span>Du loggade in med ett tillfälligt lösenord. Byt till ett eget innan du fortsätter.</span>
            <Link href="/admin/konto?byt=1" className="rounded-full bg-white px-4 py-1.5 text-red-deep">
              Byt lösenord
            </Link>
          </div>
        )}
        <main id="innehall" className="mx-auto max-w-6xl px-5 pb-24 pt-8 md:px-10 md:pt-12">
          {expiresAt && (
            <Notice tone="warning">
              Din inloggning går ut {formatTimestamp(expiresAt)}. Den förlängs när du sparar något, annars behöver du logga in igen.
            </Notice>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper">
      <div role="status" className="size-8 animate-spin rounded-full border-2 border-ink/15 border-t-red" aria-label="Laddar" />
      <noscript>
        <p className="mt-4 text-sm text-stone">Adminpanelen behöver JavaScript. Slå på det i webbläsaren och ladda om sidan.</p>
      </noscript>
    </div>
  );
}
