export type RepertoireOrigin = "manual" | "ai";

export interface SocioculturalRepertoire {
  id: string;
  user_id: string;
  title: string;
  category: string;
  summary: string;
  purpose: string;
  application_example: string;
  themes: string[];
  niches: string[];
  source_title: string | null;
  source_author: string | null;
  source_year: string | null;
  source_url: string | null;
  origin: RepertoireOrigin;
  created_at: string;
  updated_at: string;
}

export type RepertoireDraft = Omit<
  SocioculturalRepertoire,
  "id" | "user_id" | "created_at" | "updated_at" | "origin"
> & { origin: RepertoireOrigin };

export type GeneratedRepertoire = Omit<
  RepertoireDraft,
  "origin" | "source_title" | "source_author" | "source_year" | "source_url"
> & Partial<Pick<RepertoireDraft, "source_title" | "source_author" | "source_year" | "source_url">>;

export const EMPTY_REPERTOIRE_DRAFT: RepertoireDraft = {
  title: "",
  category: "",
  summary: "",
  purpose: "",
  application_example: "",
  themes: [],
  niches: [],
  source_title: "",
  source_author: "",
  source_year: "",
  source_url: "",
  origin: "manual",
};
