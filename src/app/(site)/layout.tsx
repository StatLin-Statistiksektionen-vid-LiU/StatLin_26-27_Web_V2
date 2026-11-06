import { Suspense } from "react";
import { AdminBarLoader } from "@/components/edit-mode/admin-bar-loader";
import { Announcement } from "@/components/layout/announcement";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MenuSponsors } from "@/components/layout/sponsors";
import { SearchDialogHost } from "@/components/search/search-dialog-host";
import { StarNavGuard } from "@/components/star/star-nav-guard";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Sponsorerna står i sidomenyn på datorn och i menyn på telefonen. Utan sponsorer blir det ingenting. */}
      <SiteHeader
        sponsors={{
          sidebar: (
            <Suspense fallback={null}>
              <MenuSponsors className="border-t border-line px-4 py-3" />
            </Suspense>
          ),
          menu: (
            <Suspense fallback={null}>
              <MenuSponsors className="mx-1 mt-6 border-t border-line pt-6" />
            </Suspense>
          ),
        }}
      />
      {/* Sidomenyn ligger fast till vänster på datorn, så sidan och sidfoten börjar till höger om den. */}
      <div className="lg:pl-[var(--sidebar-w)]">
        {/* Sidan strömmas in. Utan minsta höjd står sidfoten mitt på skärmen tills innehållet kommer och knuffar ner den. */}
        <main id="innehall" className="min-h-svh">
          {children}
        </main>
        <SiteFooter />
      </div>
      {/* Sökrutan: sökknapparna och snabbtangenterna öppnar den, och dess kod hämtas först när den behövs. */}
      <Suspense fallback={null}>
        <SearchDialogHost />
      </Suspense>
      <Suspense fallback={null}>
        <Announcement />
      </Suspense>
      {/* Tar bort länken till STAR-sidan ur menyerna när den är dold. */}
      <Suspense fallback={null}>
        <StarNavGuard />
      </Suspense>
      {/* Bara för inloggade: redigeringsläget och genvägar till adminpanelen. */}
      <Suspense fallback={null}>
        <AdminBarLoader />
      </Suspense>
    </>
  );
}
