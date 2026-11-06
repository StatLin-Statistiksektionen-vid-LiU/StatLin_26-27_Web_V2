import { Avatar } from "./avatar";
import { Mail } from "@/components/icons";
import type { BoardMember } from "@/lib/types";
import { Editable } from "@/components/edit-mode/editable";

export function BoardCard({ member }: { member: BoardMember }) {
  const name = member.name || "Vakant";
  return (
    <Editable target={{ type: "board", id: member.id }} className="group flex h-full flex-col">
      <div className="relative overflow-hidden rounded-xl">
        <Avatar
          name={member.name || member.post}
          seed={`${member.id}-${member.post}`}
          photo={member.photo}
          className="aspect-[4/5] w-full transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
        />
        <span className="chip absolute left-3 top-3 h-auto min-h-[1.7rem] max-w-[calc(100%-0.75rem)] whitespace-normal bg-white/95 py-0.5 opak:bg-white text-center text-ink [overflow-wrap:anywhere] max-[25.9375rem]:max-w-[calc(100%-1.5rem)] max-[20.8125rem]:px-1.5">
          {breakablePost(member.post)}
        </span>
      </div>
      <div className="flex flex-1 flex-col pt-4">
        <p className="text-lg font-bold tracking-tight">{name}</p>
        {member.bio && <p className="mt-1.5 text-[0.93rem] leading-relaxed text-stone">{member.bio}</p>}
        {member.email && (
          <a href={`mailto:${member.email}`} aria-label={member.email} className="mt-auto inline-flex items-center gap-2 pt-3 text-sm font-semibold text-red-deep">
            <Mail size={15} className="shrink-0" />
            <EmailText email={member.email} />
          </a>
        )}
      </div>
    </Editable>
  );
}

/** Mjukt bindestreck före efterleden, så att långa poster bryts vid ordfogen i smala kort. */
function breakablePost(post: string) {
  return post.replace(/(\p{L})(ansvarig|bevakare|ombud)/giu, "$1\u00AD$2");
}

/** Adresser som inte ryms bredvid ikonen bryts efter @. Chromium läser `<wbr>` som ett mellanslag, så länken har `aria-label`. */
function EmailText({ email }: { email: string }) {
  const afterAt = email.indexOf("@") + 1;
  return (
    <span className="link-underline [overflow-wrap:anywhere]">
      {email.slice(0, afterAt)}
      <wbr />
      {email.slice(afterAt)}
    </span>
  );
}
