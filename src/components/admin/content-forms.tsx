import { saveBoardMember, saveCommittee, savePage, saveSettings } from "@/app/admin/_actions/content";
import type { BoardMember, Committee, Page, SiteSettings } from "@/lib/types";
import { ActionForm } from "./action-form";
import { ColorInput, Field, FormSection, Select, TextArea, TextInput, Toggle } from "./fields";
import { ImageField } from "./image-field";
import { MarkdownEditor } from "./markdown-editor";
import { TEXT_LIMITS } from "@/lib/admin/limits";
import { SITE_TEXT_GROUPS, textDef, textsIn, type SiteTextGroup } from "@/lib/site-texts";

/*
 * Formulären används både på adminsidorna och i redigeringspanelen på sajten. onSaved anges bara
 * av panelen, som stänger sig och laddar om sidan efter en sparning.
 */

export function PageForm({ page, onSaved }: { page: Page; onSaved?: () => void }) {
  return (
    <ActionForm action={savePage} submitLabel="Spara och publicera" onSuccess={onSaved} version={page.updated_at}>
      <input type="hidden" name="slug" value={page.slug} />
      <FormSection title="Sidhuvud" description="Skriv *ord* med stjärnor i titeln för att göra dem röda.">
        <Field label="Titel" name="title" required>
          <TextInput name="title" defaultValue={page.title} maxLength={120} className="text-lg font-semibold" />
        </Field>
        <Field label="Ingress" name="lead" hint="Visas stort under titeln.">
          <TextArea name="lead" defaultValue={page.lead} rows={3} maxLength={500} />
        </Field>
      </FormSection>
      <FormSection title="Innehåll" description="Tips: använd ▸-knappen för utfällbara frågor och svar.">
        <MarkdownEditor name="body_md" label="Text" defaultValue={page.body_md} rows={24} max={TEXT_LIMITS.page} />
      </FormSection>
    </ActionForm>
  );
}

export function CommitteeForm({ committee: c, editor, onSaved }: { committee: Committee; editor: boolean; onSaved?: () => void }) {
  return (
    <ActionForm action={saveCommittee} onSuccess={onSaved} version={c.updated_at}>
      <input type="hidden" name="id" value={c.id} />
      {/* Ingen logo_url här: loggan byts genom att ladda upp en bild (SD-10). */}
      <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-3">
        <div className="space-y-6 @2xl:col-span-2">
          <FormSection title="Presentation">
            <div className="grid gap-5 @md:grid-cols-[1fr_10rem]">
              <Field label="Fullständigt namn" name="name" required>
                <TextInput name="name" defaultValue={c.name} maxLength={120} />
              </Field>
              <Field label="Förkortning" name="short_name" required>
                <TextInput name="short_name" defaultValue={c.short_name} maxLength={30} />
              </Field>
            </div>
            <Field label="Slogan" name="tagline" hint="En mening som visas på utskottskortet.">
              <TextArea name="tagline" defaultValue={c.tagline} rows={2} maxLength={200} />
            </Field>
            <MarkdownEditor name="description_md" label="Beskrivning" defaultValue={c.description_md} max={TEXT_LIMITS.committee} />
          </FormSection>
          <FormSection title="Kontakt">
            <div className="grid gap-5 @md:grid-cols-2">
              <Field label="E-post" name="email">
                <TextInput name="email" type="email" defaultValue={c.email} />
              </Field>
              <Field label="Instagram" name="instagram">
                <TextInput name="instagram" type="url" defaultValue={c.instagram} placeholder="https://instagram.com/…" />
              </Field>
            </div>
          </FormSection>
        </div>
        <div className="space-y-6">
          <FormSection title="Logga" description="Utskottsloggor regleras av det grafiska styrdokumentet. Byt bara till en godkänd version.">
            {c.logo_url && (
              <div className="flex items-center gap-3 rounded-xl bg-paper p-3 text-sm text-stone">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.logo_url} alt="" className="size-12 object-contain" /> Nuvarande logga
              </div>
            )}
            {/* Ny key när loggan sparats: den nya står då som nuvarande, och fältet är tomt igen. */}
            <ImageField key={c.logo_url ?? "ingen"} name="logo_media_id" label="Ladda upp ny logga" defaultImage={null} aspect="aspect-[5/2]" fit="contain" hint="PNG med transparent bakgrund blir bäst." />
          </FormSection>
          <FormSection title="Utseende">
            <Field label="Accentfärg" name="accent" hint="Används för detaljer och genererade omslag.">
              <div className="flex items-center gap-3">
                <ColorInput name="accent" defaultValue={c.accent} />
              </div>
            </Field>
            {editor && (
              <>
                <Toggle name="visible" label="Visas på sajten" defaultChecked={!!c.visible} />
                <Field label="Plats i listan" name="sort_order" hint="Lägre tal visas först.">
                  <TextInput name="sort_order" type="number" defaultValue={c.sort_order} min={0} />
                </Field>
              </>
            )}
          </FormSection>
        </div>
      </div>
    </ActionForm>
  );
}

export function BoardMemberForm({
  member,
  committees,
  nextOrder,
  onSaved,
}: {
  member: BoardMember | null;
  committees: Pick<Committee, "id" | "short_name">[];
  nextOrder: number;
  onSaved?: () => void;
}) {
  return (
    <ActionForm action={saveBoardMember} submitLabel={member ? "Spara" : "Lägg till"} onSuccess={onSaved}>
      {member && <input type="hidden" name="id" value={member.id} />}
      {/* Platsen ändras med pilarna i listan. Bara en ny post får en plats härifrån, så att en gammal flik inte flyttar tillbaka en post. */}
      {!member && <input type="hidden" name="sort_order" value={nextOrder} />}
      <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-3">
        <div className="space-y-6 @2xl:col-span-2">
          <FormSection title="Post">
            <div className="grid gap-5 @md:grid-cols-2">
              <Field label="Post" name="post" required>
                <TextInput name="post" defaultValue={member?.post} placeholder="Kassör" maxLength={80} />
              </Field>
              <Field label="Namn" name="name" hint="Lämna tomt om posten är vakant.">
                <TextInput name="name" defaultValue={member?.name} maxLength={120} />
              </Field>
            </div>
            <div className="grid gap-5 @md:grid-cols-2">
              <Field label="E-post" name="email">
                <TextInput name="email" type="email" defaultValue={member?.email} placeholder="kassor@statlin.se" />
              </Field>
              <Field label="Kopplad till" name="committee_id" hint="Visas som kontaktperson på utskottets sida.">
                <Select name="committee_id" defaultValue={String(member?.committee_id ?? "")}>
                  <option value="">Ingen</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.short_name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Ansvarsområde" name="bio" hint="Kort beskrivning av vad posten gör.">
              <TextArea name="bio" defaultValue={member?.bio} rows={3} maxLength={400} />
            </Field>
          </FormSection>
        </div>
        <FormSection title="Porträtt">
          <ImageField name="photo_media_id" label="Foto" defaultImage={member?.photo ?? null} aspect="aspect-[4/5]" hint="Utan foto visas initialer på en genererad bakgrund." />
        </FormSection>
      </div>
    </ActionForm>
  );
}

/* Inställningarna i sektioner. saveSettings sparar bara fälten som finns i formuläret. */

/** Det på startsidan som inte är text: formelringen runt loggan och tidslinjens färger. */
function HomeLookFields({ s }: { s: SiteSettings }) {
  return (
    <>
      <Field label="Formelringen runt loggan" name="hero_formulas" hint="Formlerna som kommer fram runt loggan när musen är nära. På telefon kommer de fram när man trycker på loggan.">
        <Select name="hero_formulas" defaultValue={s.hero_formulas}>
          <option value="pa">På</option>
          <option value="av">Av, bara loggan</option>
        </Select>
      </Field>
      <Field label="Tidslinjens färger" name="band_color" hint="Tidslinjen med kommande evenemang, direkt under heron.">
        <Select name="band_color" defaultValue={s.band_color}>
          <option value="vit">Vitt med röd linje</option>
          <option value="rod">Rött med vit text</option>
          <option value="natt">Natthimmel som på STAR</option>
        </Select>
      </Field>
    </>
  );
}

export function HomeTextsSection({ s, className }: { s: SiteSettings; className?: string }) {
  return (
    <FormSection title="Startsidan" description="Skriv *ord* med stjärnor för att göra dem röda och _ord_ med understreck för att skriva dem för hand (_*ord*_ blir röd handstil). Tryck Enter för en ny rad." className={className}>
      <Field label="Liten rad ovanför" name="hero_kicker">
        <TextInput name="hero_kicker" defaultValue={s.hero_kicker} maxLength={80} />
      </Field>
      <Field label="Rubrik" name="hero_title" required hint="T.ex. Sektionen för *statistik*, dataanalys och maskininlärning vid LiU">
        <TextArea name="hero_title" defaultValue={s.hero_title} rows={2} maxLength={140} required />
      </Field>
      <Field label="Underrubrik" name="hero_text">
        <TextArea name="hero_text" defaultValue={s.hero_text} rows={2} maxLength={300} />
      </Field>
      <Field label="Om sektionen" name="home_intro" required hint="Texten under heron, vid siffrorna.">
        <TextArea name="home_intro" defaultValue={s.home_intro} rows={3} maxLength={400} required />
      </Field>
      <HomeLookFields s={s} />
    </FormSection>
  );
}

export function ContactSection({ s }: { s: SiteSettings }) {
  return (
    <FormSection title="Kontakt">
      <Field label="Allmän e-post" name="contact_email" required>
        <TextInput name="contact_email" type="email" defaultValue={s.contact_email} />
      </Field>
      <Field label="Adress" name="address">
        <TextInput name="address" defaultValue={s.address} />
      </Field>
      <Field label="Sektionsrum" name="sektionsrum" hint="Var hittar man er på campus?">
        <TextInput name="sektionsrum" defaultValue={s.sektionsrum} />
      </Field>
      <Field label="Organisationsnummer" name="org_number">
        <TextInput name="org_number" defaultValue={s.org_number} />
      </Field>
    </FormSection>
  );
}

export function SocialSection({ s }: { s: SiteSettings }) {
  return (
    <FormSection title="Sociala medier" description="Tomma fält döljs på sajten.">
      <Field label="Instagram" name="instagram">
        <TextInput name="instagram" type="url" defaultValue={s.instagram} placeholder="https://instagram.com/…" />
      </Field>
      <Field label="Facebook" name="facebook">
        <TextInput name="facebook" type="url" defaultValue={s.facebook} placeholder="https://facebook.com/…" />
      </Field>
      <Field label="LinkedIn" name="linkedin">
        <TextInput name="linkedin" type="url" defaultValue={s.linkedin} placeholder="https://linkedin.com/company/…" />
      </Field>
    </FormSection>
  );
}

export function AnnouncementSection({ s }: { s: SiteSettings }) {
  return (
    <FormSection title="Meddelande" description="En kort rad som dyker upp längst ned på sidorna, t.ex. inför årsmötet. På startsidan väntar den tills besökaren har scrollat en bit. Lämna tomt för att dölja.">
      <Field label="Text" name="announcement">
        <TextInput name="announcement" defaultValue={s.announcement} maxLength={200} placeholder="Årsmöte 12 mars: läs handlingarna" />
      </Field>
      <Field label="Länk" name="announcement_url">
        <TextInput name="announcement_url" defaultValue={s.announcement_url} placeholder="/dokument" />
      </Field>
    </FormSection>
  );
}

export function EducationCommitteeSection({ s, committees }: { s: SiteSettings; committees: Pick<Committee, "id" | "name">[] }) {
  return (
    <FormSection title="Utbildningsutskottet" description="Utskottet vars kontaktkort visas på sidorna om kandidat- och masterprogrammet.">
      <Field label="Utskott" name="education_committee_id" hint="Automatiskt betyder utskottet med adressen ubu. Byter ni adress på det, välj det här så att kortet inte försvinner.">
        <Select name="education_committee_id" defaultValue={s.education_committee_id}>
          <option value="">Automatiskt</option>
          {committees.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
    </FormSection>
  );
}

/** Läget sajten öppnas i, för datorn och telefonen var för sig. Se src/lib/tema.ts. */
export function ThemeSection({ s }: { s: SiteSettings }) {
  return (
    <FormSection title="Mörkt eller ljust läge" description="Läget sajten öppnas i för besökare som inte själva har valt. Den som har tryckt på knappen för läget behåller sitt eget val.">
      <Field label="På datorn" name="tema_dator" hint="När sidomenyn syns till vänster, på skärmar som är minst 1024 pixlar breda.">
        <Select name="tema_dator" defaultValue={s.tema_dator}>
          <option value="mork">Mörkt</option>
          <option value="ljust">Ljust</option>
        </Select>
      </Field>
      <Field label="På telefonen" name="tema_telefon" hint="När menyn öppnas med knappen upptill, alltså på telefoner och smalare skärmar.">
        <Select name="tema_telefon" defaultValue={s.tema_telefon}>
          <option value="mork">Mörkt</option>
          <option value="ljust">Ljust</option>
        </Select>
      </Field>
    </FormSection>
  );
}

/** Sidfotens två texter: den stora sloganen under loggan och beskrivningen under den. */
export function TaglineSection({ s }: { s: SiteSettings }) {
  return (
    <FormSection title="Sidfoten">
      <Field label="Slogan" name="footer_slogan" hint="Den stora raden under loggan längst ner på sidan. Skriv *ord* med stjärnor för att göra dem röda. Lämna tomt för att ta bort raden.">
        <TextInput name="footer_slogan" defaultValue={s.footer_slogan} maxLength={120} />
      </Field>
      <Field label="Beskrivning" name="tagline" hint="Visas i sidfoten. Skriv *ord* med stjärnor för att göra dem röda.">
        <TextInput name="tagline" defaultValue={s.tagline} maxLength={200} />
      </Field>
    </FormSection>
  );
}

/** En grupp av sajtens fasta texter, se site-texts.ts. Fältet visar det som står på sajten nu, och ett tomt fält ger standardtexten. */
export function SiteTextsSection({ group, s, className, title }: { group: SiteTextGroup; s: SiteSettings; className?: string; title?: string }) {
  return (
    <FormSection title={title ?? SITE_TEXT_GROUPS[group]} description="Skriv *ord* med stjärnor i rubriker och texter för att göra dem röda, och _ord_ med understreck för att skriva dem för hand (_*ord*_ blir röd handstil). Ett tomt fält ger tillbaka standardtexten." className={className}>
      {textsIn(group).map((key) => {
        const t = textDef(key);
        return (
          <Field key={key} label={t.label} name={key} hint={`Standard: ${t.default}`}>
            {t.long ? <TextArea name={key} defaultValue={s[key]} rows={4} maxLength={t.max} /> : <TextInput name={key} defaultValue={s[key]} maxLength={t.max} />}
          </Field>
        );
      })}
    </FormSection>
  );
}

/** Knappen vid loggan i redigeringsläget. Startsidans texter ändras där de står, så här finns bara resten. */
export function HomeTextsForm({ s, onSaved }: { s: SiteSettings; onSaved?: () => void }) {
  return (
    <ActionForm action={saveSettings} onSuccess={onSaved}>
      <FormSection title="Loggan och tidslinjen" description="Texterna på startsidan ändrar du genom att klicka på dem.">
        <HomeLookFields s={s} />
      </FormSection>
    </ActionForm>
  );
}

/** En grupp av sajtens fasta texter, för pennorna på startsidans rubriker och listsidornas huvuden. */
export function SiteTextsForm({ group, s, onSaved }: { group: SiteTextGroup; s: SiteSettings; onSaved?: () => void }) {
  return (
    <ActionForm action={saveSettings} onSuccess={onSaved}>
      {/* Panelens rubrik säger redan vilken del av sajten det gäller. */}
      <SiteTextsSection group={group} s={s} title="Texterna" />
    </ActionForm>
  );
}

/** Kontaktuppgifterna och sociala medier, för pennorna på kontaktsidan. */
export function ContactSettingsForm({ s, onSaved }: { s: SiteSettings; onSaved?: () => void }) {
  return (
    <ActionForm action={saveSettings} onSuccess={onSaved}>
      <ContactSection s={s} />
      <SocialSection s={s} />
    </ActionForm>
  );
}

/** Sidfotens uppgifter och meddelandet högst upp. */
export function FooterSettingsForm({ s, onSaved }: { s: SiteSettings; onSaved?: () => void }) {
  return (
    <ActionForm action={saveSettings} onSuccess={onSaved}>
      <ContactSection s={s} />
      <SocialSection s={s} />
      <TaglineSection s={s} />
      <AnnouncementSection s={s} />
    </ActionForm>
  );
}
