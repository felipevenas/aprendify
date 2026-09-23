export type RepertoireInput = {
  topic: string;
  focus?: string;
  context?: string;
};

export type GeneratedRepertoire = {
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
  origin: "ai";
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "INVALID_INPUT" | "INVALID_AI_OUTPUT"; message: string };

function boundedText(value: unknown, maxLength: number, required = true): string | null {
  if (typeof value !== "string") return required ? null : "";
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maxLength) return null;
  return normalized;
}

export function validateRepertoireInput(value: unknown): ValidationResult<RepertoireInput> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "INVALID_INPUT", message: "O corpo deve ser um objeto JSON." };
  }
  const input = value as Record<string, unknown>;
  const topic = boundedText(input.topic, 180);
  const focus = boundedText(input.focus, 180, false);
  const context = boundedText(input.context, 800, false);
  if (topic === null || focus === null || context === null) {
    return { ok: false, code: "INVALID_INPUT", message: "Informe um tema válido e mantenha os campos dentro dos limites." };
  }
  if (!focus && !context) {
    return { ok: true, value: { topic } };
  }
  return {
    ok: true,
    value: { topic, ...(focus ? { focus } : {}), ...(context ? { context } : {}) },
  };
}

function optionalSourceText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  const text = boundedText(value, maxLength);
  return text === null ? undefined : text;
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) return null;
  const normalized = value.map((item) => boundedText(item, 100));
  if (normalized.some((item) => item === null)) return null;
  return [...new Set(normalized as string[])];
}

export function parseGeneratedRepertoire(raw: unknown): ValidationResult<GeneratedRepertoire> {
  if (typeof raw !== "string" || raw.length > 16_000) {
    return { ok: false, code: "INVALID_AI_OUTPUT", message: "A IA retornou uma resposta inválida." };
  }
  const jsonText = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, code: "INVALID_AI_OUTPUT", message: "A IA não retornou JSON válido." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, code: "INVALID_AI_OUTPUT", message: "A IA retornou um formato inesperado." };
  }
  const source = parsed as Record<string, unknown>;
  const title = boundedText(source.title, 180);
  const category = boundedText(source.category, 80);
  const summary = boundedText(source.summary, 1200);
  const purpose = boundedText(source.purpose, 1200);
  const applicationExample = boundedText(source.application_example, 2400);
  const themes = stringList(source.themes);
  const niches = stringList(source.niches);
  const sourceTitle = optionalSourceText(source.source_title, 180);
  const sourceAuthor = optionalSourceText(source.source_author, 120);
  const sourceYear = optionalSourceText(source.source_year, 40);
  const sourceUrl = optionalSourceText(source.source_url, 500);
  if (
    title === null || category === null || summary === null || purpose === null ||
    applicationExample === null || themes === null || niches === null ||
    sourceTitle === undefined || sourceAuthor === undefined || sourceYear === undefined || sourceUrl === undefined
  ) {
    return { ok: false, code: "INVALID_AI_OUTPUT", message: "A IA retornou campos incompletos ou fora dos limites." };
  }
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    return { ok: false, code: "INVALID_AI_OUTPUT", message: "A referência retornada contém uma URL inválida." };
  }
  return {
    ok: true,
    value: {
      title,
      category,
      summary,
      purpose,
      application_example: applicationExample,
      themes,
      niches,
      source_title: sourceTitle,
      source_author: sourceAuthor,
      source_year: sourceYear,
      source_url: sourceUrl,
      origin: "ai",
    },
  };
}
