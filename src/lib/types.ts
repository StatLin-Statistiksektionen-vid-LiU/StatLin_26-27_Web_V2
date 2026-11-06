import type { SiteTextKey } from "./site-texts";

export const ROLE_VALUES = ["admin", "editor", "committee"] as const;
export type Role = (typeof ROLE_VALUES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administratör",
  editor: "Redaktör",
  committee: "Utskott",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Allt, inklusive konton och granskning av evenemang.",
  editor: "Allt innehåll och sajtens inställningar: evenemang, nytt, bilder, sidor, styrelse och dokument.",
  committee: "Det egna utskottets evenemang, nytt, bilder och sida. Uppdragstavlan, projektplanerna och årshjulet delas med alla poster.",
};

export interface Media {
  id: number;
  kind: "image" | "file";
  path_base: string;
  ext: string;
  variants: string;
  original_name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  color: string | null;
  alt: string;
  uploaded_by: number | null;
  created_at: string;
}

/** Det som skickas till klienten om en bild – inga interna sökvägar. */
export interface ImageRef {
  id: number;
  src: string;
  srcSet: string;
  thumb: string;
  width: number;
  height: number;
  color: string;
  alt: string;
}

export interface Committee {
  id: number;
  slug: string;
  name: string;
  short_name: string;
  tagline: string;
  description_md: string;
  logo_url: string | null;
  accent: string;
  email: string;
  instagram: string;
  kind: "styrelse" | "utskott" | "ovrigt";
  sort_order: number;
  visible: boolean;
  /** Önskelådan på utskottets sida. Utskottet slår på och av den själv. */
  wishes_open: boolean;
  updated_at: string;
}

export interface UserRow {
  id: number;
  email: string;
  name: string;
  post: string;
  role: Role;
  committee_id: number | null;
  password_hash: string;
  must_change_password: number;
  active: number;
  failed_logins: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  /** Grafiskt ansvar: bilder och omslag på hela sajten, oavsett roll och utskott. */
  design: number;
}

export type SessionUser = Pick<UserRow, "id" | "email" | "name" | "post" | "role" | "committee_id"> & {
  must_change_password: boolean;
  design: boolean;
  committee_name: string | null;
  committee_kind: Committee["kind"] | null;
};

export interface BoardMember {
  id: number;
  post: string;
  name: string;
  email: string;
  bio: string;
  photo_media_id: number | null;
  committee_id: number | null;
  sort_order: number;
  photo: ImageRef | null;
}

export interface EventItem {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body_md: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string;
  location_url: string;
  committee_id: number | null;
  cover_media_id: number | null;
  signup_url: string;
  price: string;
  published: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  /** Satt när en administratör granskat evenemanget. Styr aldrig om det visas på sajten. */
  checked_at: string | null;
  checked_by: number | null;
  committee: Pick<Committee, "id" | "slug" | "name" | "short_name" | "logo_url" | "accent" | "visible" | "kind"> | null;
  cover: ImageRef | null;
  image_count: number;
}

export interface EventImage {
  id: number;
  event_id: number;
  caption: string;
  sort_order: number;
  image: ImageRef;
}

export interface NewsItem {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  cover_media_id: number | null;
  committee_id: number | null;
  published: boolean;
  pinned: boolean;
  published_at: string;
  author_id: number | null;
  author_name: string | null;
  author_post: string | null;
  created_at: string;
  updated_at: string;
  committee: Pick<Committee, "id" | "slug" | "name" | "short_name" | "logo_url" | "accent" | "visible" | "kind"> | null;
  cover: ImageRef | null;
}

export const DOCUMENT_CATEGORY_VALUES = ["styrdokument", "protokoll", "grafiskt", "ovrigt"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORY_VALUES)[number];

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, string> = {
  styrdokument: "Stadgar & reglemente",
  protokoll: "Protokoll",
  grafiskt: "Grafisk profil",
  ovrigt: "Övrigt",
};

export type TaskStatus = "planerad" | "pagar" | "hjalp" | "klar";

export const TASK_STATUSES: Record<TaskStatus, string> = {
  planerad: "Att göra",
  pagar: "Pågår",
  hjalp: "Behöver hjälp",
  klar: "Klart",
};

/** Ett konto på uppdragstavlan, visat som sin post (t.ex. "Grafiskt ansvarig") och sitt utskott. */
export interface TaskPerson {
  id: number;
  label: string;
  committee: string | null;
  accent: string | null;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  from_user_id: number | null;
  to_user_id: number | null;
  status: TaskStatus;
  shared: number;
  due_date: string | null;
  event_id: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  from: TaskPerson | null;
  to: TaskPerson | null;
  event: { id: number; title: string; slug: string; committee_id: number | null } | null;
  comment_count: number;
  plan: { id: number; title: string } | null;
}

export interface TaskComment {
  id: number;
  task_id: number;
  body: string;
  created_at: string;
  author: TaskPerson | null;
}

export interface DocumentItem {
  id: number;
  title: string;
  category: DocumentCategory;
  description: string;
  media_id: number | null;
  url: string;
  doc_date: string | null;
  published: boolean;
  sort_order: number;
  created_at: string;
  file: { href: string; size: number; ext: string } | null;
}

export interface Page {
  slug: string;
  title: string;
  lead: string;
  body_md: string;
  updated_at: string;
  updated_by: number | null;
}

export interface Partner {
  id: number;
  name: string;
  url: string;
  description: string;
  logo_media_id: number | null;
  tier: "huvudpartner" | "partner";
  sort_order: number;
  active: boolean;
  logo: ImageRef | null;
}

export type LinkCategory = "studier" | "tentor" | "it" | "campus" | "stod" | "statlin";

export interface LinkItem {
  id: number;
  label: string;
  description: string;
  url: string;
  keywords: string;
  category: LinkCategory;
  icon: string;
  featured: boolean;
  sort_order: number;
  active: boolean;
}

export type Program = "kandidat" | "master";

export const RESOURCE_CATEGORY_VALUES = ["fusklapp", "kod", "guide", "ovrigt"] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORY_VALUES)[number];

/** bada = syns under både Kandidat och Master. */
export const RESOURCE_PROGRAM_VALUES = ["kandidat", "master", "bada"] as const;
export type ResourceProgram = (typeof RESOURCE_PROGRAM_VALUES)[number];

export interface ResourceItem {
  id: number;
  title: string;
  description: string;
  program: ResourceProgram;
  /** 1–6, null = hela programmet. */
  term: number | null;
  category: ResourceCategory;
  media_id: number | null;
  url: string;
  created_at: string;
  file: { href: string; size: number; ext: string; image: boolean } | null;
}

/** Inställningarna, och sajtens fasta texter i site-texts.ts som går att ändra med pennan i redigeringsläget. */
export interface SiteSettings extends Record<SiteTextKey, string> {
  contact_email: string;
  /** Dagordningsmallen för styrelsemötena, en punkt per rad. Ändras av ordföranden under Möten. */
  meeting_template: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  address: string;
  sektionsrum: string;
  org_number: string;
  tagline: string;
  /** Den stora raden under loggan i sidfoten. *ord* blir röda. Tom: ingen rad. */
  footer_slogan: string;
  hero_kicker: string;
  hero_title: string;
  hero_text: string;
  hero_ring_color: "red" | "white";
  /** Formelringen runt loggan på startsidan, på eller av. */
  hero_formulas: "pa" | "av";
  band_color: "vit" | "rod" | "natt";
  home_intro: string;
  announcement: string;
  announcement_url: string;
  /** Evenemanget vars datum visas som STAR på företagssidan. Tomt: väljs med adressen, se getStarEvent. */
  star_event_id: string;
  /** "1" när STAR-sidan är live. Annars ser besökare bara att den kommer snart, se starIsLive. */
  star_live: string;
  star_subtitle: string;
  star_intro: string;
  star_companies_intro: string;
  star_sponsors_intro: string;
  /** Ett tips per rad, se parseStarTips. */
  star_tips: string;
  /** Fråga på första raden, svar på nästa och en tom rad mellan frågorna, se parseStarFaq. */
  star_faq: string;
  star_student_title: string;
  star_student_text: string;
  star_company_title: string;
  star_company_text: string;
  star_teaser: string;
  /** Utskottet på programsidornas kontaktkort. Tomt: se getEducationCommittee. */
  education_committee_id: string;
}
