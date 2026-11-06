import Link from "next/link";
import { Eye, Mail, Users } from "@/components/icons";
import { CopyButton } from "@/components/ui/copy-button";
import { mailtoDraft, shareTexts } from "@/lib/fragelada";

type Props = {
  boxId: number;
  title: string;
  code: string | null;
  link: string;
  base: string;
  sender: string;
  /** Lådan har redan frågor: då är delningen inte det första ägaren vill se. */
  folded?: boolean;
};

const CARD = "flex flex-col rounded-xl border border-line bg-white p-5";

/**
 * De tre sätten att få ut en kod. Sajten skickar inga mejl själv, så knapparna öppnar avsändarens eget mejlprogram med
 * texten ifylld. Mottagaren väljer avsändaren där, och sajten får aldrig veta vilka som fick koden.
 */
export function ShareCode({ boxId, title, code, link, base, sender, folded = false }: Props) {
  const texts = shareTexts({ title, code, link, base, sender });
  const what = code ? "koden" : "länken";
  const body = (
    <>
      <p className="mt-1 max-w-2xl text-[0.95rem] text-stone">Knapparna öppnar ditt eget mejlprogram med texten ifylld, så väljer du vilka som ska få den. Sajten skickar inget själv och sparar inte vilka som fick den.</p>
      <ul className="mt-4 grid gap-4 md:grid-cols-3">
        <li className={CARD}>
          <h3 className="flex items-center gap-2 font-bold">
            <Mail size={18} /> Via mejl
          </h3>
          <p className="mt-2 flex-1 text-[0.95rem] text-stone">Till dem du vill höra från. Lägg gärna adresserna som dold kopia, så syns de inte för varandra.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={mailtoDraft(texts.mail)} className="btn btn-ink btn-sm">
              Skriv mejlet
            </a>
            <CopyButton value={texts.mail.body} label="Kopiera texten" className="btn btn-ghost btn-sm font-sans" />
          </div>
        </li>
        <li className={CARD}>
          <h3 className="flex items-center gap-2 font-bold">
            <Users size={18} /> Via läraren
          </h3>
          <p className="mt-2 flex-1 text-[0.95rem] text-stone">Be läraren dela {what} på en föreläsning eller i Lisam. Mejlet har en färdig text som läraren kan klistra in.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={mailtoDraft(texts.teacher)} className="btn btn-ink btn-sm">
              Mejla läraren
            </a>
            <CopyButton value={texts.short} label="Kopiera kort text" className="btn btn-ghost btn-sm font-sans" />
          </div>
        </li>
        <li className={CARD}>
          <h3 className="flex items-center gap-2 font-bold">
            <Eye size={18} /> På plats
          </h3>
          <p className="mt-2 flex-1 text-[0.95rem] text-stone">Visa {what} stort på en skärm i salen, så kan alla skriva av den direkt.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/admin/fragelada/${boxId}/skarm`} className="btn btn-ghost btn-sm">
              Visa på skärm
            </Link>
          </div>
        </li>
      </ul>
    </>
  );
  if (folded) {
    return (
      <details className="mt-12 rounded-xl border border-line bg-white p-5">
        <summary className="tryck cursor-pointer font-bold">Så får de {what}</summary>
        <div className="mt-3">{body}</div>
      </details>
    );
  }
  return (
    <section aria-labelledby="dela-koden" className="mt-8">
      <h2 id="dela-koden" className="text-xl font-extrabold tracking-tight">
        Så får de {what}
      </h2>
      {body}
    </section>
  );
}
