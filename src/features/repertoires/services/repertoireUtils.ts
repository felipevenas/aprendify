import type { GeneratedRepertoire, RepertoireDraft, RepertoireOrigin } from "../types";

export type RepertoireFieldErrors = Partial<Record<keyof RepertoireDraft, string>>;

export function resolveGenerationTopic(
  selectedId: string,
  manualTopic: string,
  essayTopics: ReadonlyArray<{ id: string; title: string }>,
): string {
  if (selectedId === "__other_topic__") return manualTopic.trim();
  return essayTopics.find((topic) => topic.id === selectedId)?.title.trim() ?? "";
}

export function parseList(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => {
      const key = entry.toLocaleLowerCase("pt-BR");
      if (!entry || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function validateRepertoire(draft: RepertoireDraft): RepertoireFieldErrors {
  const errors: RepertoireFieldErrors = {};
  if (!draft.title.trim()) errors.title = "Informe um título para o repertório.";
  else if (draft.title.trim().length > 180) errors.title = "Use até 180 caracteres no título.";
  if (!draft.category.trim()) errors.category = "Informe uma categoria, como livro, conceito ou lei.";
  else if (draft.category.trim().length > 80) errors.category = "Use até 80 caracteres na categoria.";
  if (!draft.summary.trim()) errors.summary = "Escreva uma síntese do repertório.";
  else if (draft.summary.trim().length > 1200) errors.summary = "Use até 1.200 caracteres na síntese.";
  if (!draft.purpose.trim()) errors.purpose = "Explique para que este repertório pode servir.";
  else if (draft.purpose.trim().length > 1200) errors.purpose = "Use até 1.200 caracteres na finalidade.";
  if (!draft.application_example.trim()) errors.application_example = "Inclua um exemplo de aplicação em uma redação.";
  else if (draft.application_example.trim().length > 2400) errors.application_example = "Use até 2.400 caracteres no exemplo de aplicação.";
  if (draft.themes.length > 12) errors.themes = "Use até 12 temas relacionados.";
  if (draft.niches.length > 12) errors.niches = "Use até 12 recortes ou nichos.";
  if (new TextEncoder().encode(JSON.stringify(draft.themes)).length > 6000) {
    errors.themes = "Reduza o tamanho total dos temas.";
  }
  if (new TextEncoder().encode(JSON.stringify(draft.niches)).length > 6000) {
    errors.niches = "Reduza o tamanho total dos recortes e nichos.";
  }
  if (draft.source_title && draft.source_title.length > 180) errors.source_title = "Use até 180 caracteres no título da fonte.";
  if (draft.source_author && draft.source_author.length > 120) errors.source_author = "Use até 120 caracteres no autor ou instituição.";
  if (draft.source_year && draft.source_year.length > 40) {
    errors.source_year = "Use até 40 caracteres para o ano ou período.";
  }
  if (draft.source_url && draft.source_url.length > 500) errors.source_url = "Use até 500 caracteres no link.";
  if (draft.source_url && !/^https?:\/\//i.test(draft.source_url)) {
    errors.source_url = "Informe um endereço começando com http:// ou https://.";
  }
  return errors;
}

export function toDraft(generated: GeneratedRepertoire, origin: RepertoireOrigin = "ai"): RepertoireDraft {
  return {
    title: generated.title.trim(),
    category: generated.category.trim(),
    summary: generated.summary.trim(),
    purpose: generated.purpose.trim(),
    application_example: generated.application_example.trim(),
    themes: generated.themes,
    niches: generated.niches,
    source_title: generated.source_title ?? "",
    source_author: generated.source_author ?? "",
    source_year: generated.source_year ?? "",
    source_url: generated.source_url ?? "",
    origin,
  };
}

export function matchesRepertoireSearch(
  item: Pick<RepertoireDraft, "title" | "category" | "summary" | "themes" | "niches">,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalizedQuery) return true;
  return [item.title, item.category, item.summary, ...item.themes, ...item.niches]
    .join(" ")
    .toLocaleLowerCase("pt-BR")
    .includes(normalizedQuery);
}
