/**
 * Visas på de engelska sidorna: resten av sajten är på svenska, men webbläsarens inbyggda
 * översättning fungerar (inget på sajten blockerar den). Tas bort när hela sajten finns på engelska.
 */
export function TranslateTip() {
  return (
    <div className="rounded-xl border border-line bg-white p-6">
      <p className="kicker text-stone">Reading the rest of the site</p>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-stone">Most pages are in Swedish for now, but your browser can translate them for you.</p>
      <ul className="mt-4 space-y-2.5 text-[0.95rem] leading-relaxed text-stone">
        <li>
          <strong className="text-ink">Computer:</strong> right-click the page and choose Translate (Chrome and Edge).
        </li>
        <li>
          <strong className="text-ink">Android:</strong> open the ⋮ menu in Chrome and choose Translate.
        </li>
        <li>
          <strong className="text-ink">iPhone:</strong> open the page in the Chrome app and choose Translate in the … menu.
        </li>
      </ul>
    </div>
  );
}
