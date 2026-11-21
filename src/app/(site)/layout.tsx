import { Suspense } from "react";
import { AdminBarLoader } from "@/components/edit-mode/admin-bar-loader";
import { Announcement } from "@/components/layout/announcement";
import { MenyTrad } from "@/components/layout/meny-trad";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MenyRad } from "@/components/layout/meny-rad";
import { SparadMeny, SparadMenyRad } from "@/components/layout/sparad-meny";
import { MenuSponsors } from "@/components/layout/sponsors";
import { SearchDialogHost } from "@/components/search/search-dialog-host";
import { StarNavGuard } from "@/components/star/star-nav-guard";
import { NAV } from "@/lib/navigation";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Menyn står med standardmenyn i skalet och byts mot den sparade när den kommer. Utan JavaScript står standardmenyn kvar. */}
      {/* Huvudsponsorerna står sist i menypanelen. Utan sponsorer blir det ingenting. */}
      <SiteHeader
        meny={{
          rad: (
            <Suspense fallback={<MenyRad meny={NAV} />}>
              <SparadMenyRad />
            </Suspense>
          ),
          trad: (
            <Suspense fallback={<MenyTrad meny={NAV} />}>
              <SparadMeny />
            </Suspense>
          ),
        }}
        sponsors={
          <Suspense fallback={null}>
            <MenuSponsors className="mx-1 mt-6 border-t border-line pt-6" />
          </Suspense>
        }
      />
      {/* Sidan strömmas in. Utan minsta höjd står sidfoten mitt på skärmen tills innehållet kommer och knuffar ner den. */}
      <main id="innehall" className="min-h-svh">
        {children}
      </main>
      <SiteFooter />
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
