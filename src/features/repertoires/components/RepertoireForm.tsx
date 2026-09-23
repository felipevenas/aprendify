import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { RepertoireDraft } from "../types";
import { parseList, resolveGenerationTopic, type RepertoireFieldErrors } from "../services/repertoireUtils";

export const OTHER_TOPIC_OPTION = "__other_topic__";
export type SavedEssayOption = { id: string; title: string; created_at: string };

interface RepertoireFormProps {
  draft: RepertoireDraft;
  errors: RepertoireFieldErrors;
  isSaving: boolean;
  isGenerating: boolean;
  essayTopics: SavedEssayOption[];
  essayTopicsLoading: boolean;
  essayTopicsError: string;
  onRetryEssayTopics: () => void;
  onChange: (draft: RepertoireDraft) => void;
  onGenerate: (topic: string, context: string) => Promise<void>;
  onSave: (draft: RepertoireDraft) => void;
  onCancel: () => void;
}

type FormFieldKey = Exclude<keyof RepertoireDraft, "themes" | "niches" | "origin">;

export function RepertoireForm({ draft, errors, isSaving, isGenerating, essayTopics, essayTopicsLoading, essayTopicsError, onRetryEssayTopics, onChange, onGenerate, onSave, onCancel }: RepertoireFormProps) {
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [manualTopic, setManualTopic] = useState("");
  const [context, setContext] = useState("");
  const [generationError, setGenerationError] = useState("");
  const manualTopicRef = useRef<HTMLInputElement>(null);
  const [themesText, setThemesText] = useState(draft.themes.join(", "));
  const [nichesText, setNichesText] = useState(draft.niches.join(", "));
  useEffect(() => setThemesText(draft.themes.join(", ")), [draft.themes]);
  useEffect(() => setNichesText(draft.niches.join(", ")), [draft.niches]);

  const sortedEssayTopics = useMemo(
    () => [...essayTopics].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [essayTopics],
  );
  const essayTitleCounts = useMemo(() => sortedEssayTopics.reduce<Record<string, number>>((counts, essay) => {
    const key = essay.title.trim().toLocaleLowerCase("pt-BR");
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {}), [sortedEssayTopics]);

  const update = (key: FormFieldKey, value: string) => {
    onChange({ ...draft, [key]: value });
  };

  const generate = async () => {
    const topic = resolveGenerationTopic(selectedTopicId, manualTopic, essayTopics);
    if (!topic) {
      setGenerationError(selectedTopicId === OTHER_TOPIC_OPTION
        ? "Digite um tema de redação para orientar a geração."
        : "Selecione uma redação salva ou escolha “Outro tema”.");
      return;
    }
    setGenerationError("");
    try {
      await onGenerate(topic, context.trim());
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Não foi possível gerar agora. Seu rascunho foi mantido.");
    }
  };

  const field = (key: Exclude<keyof RepertoireDraft, "origin">, label: string, value: string, multiline = false, placeholder = "") => {
    const id = `repertoire-${key}`;
    const error = errors[key];
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        {multiline ? (
          <Textarea id={id} value={value} placeholder={placeholder} rows={key === "application_example" ? 5 : 3} disabled={isSaving || isGenerating}
            aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => key === "themes" ? setThemesText(event.target.value) : key === "niches" ? setNichesText(event.target.value) : update(key, event.target.value)}
            onBlur={() => { if (key === "themes") onChange({ ...draft, themes: parseList(themesText) }); else if (key === "niches") onChange({ ...draft, niches: parseList(nichesText) }); }} />
        ) : (
          <Input id={id} value={value} placeholder={placeholder} disabled={isSaving || isGenerating} aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => key === "themes" || key === "niches" ? onChange({ ...draft, [key]: parseList(event.target.value) }) : update(key, event.target.value)} />
        )}
        {error && <p id={`${id}-error`} className="text-sm text-destructive" role="alert">{error}</p>}
      </div>
    );
  };

  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSave({ ...draft, themes: parseList(themesText), niches: parseList(nichesText) }); }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />Comece com uma ideia</CardTitle>
          <p className="text-sm text-muted-foreground">A IA prepara uma sugestão para você revisar. Ela não será salva até você escolher salvar.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid items-start gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="self-start space-y-2">
              <Label htmlFor="generation-topic">Tema da redação</Label>
              <Select value={selectedTopicId} onValueChange={(value) => {
                setSelectedTopicId(value);
                setGenerationError("");
                if (value === OTHER_TOPIC_OPTION) window.setTimeout(() => manualTopicRef.current?.focus(), 50);
              }} disabled={isGenerating || isSaving}>
                <SelectTrigger id="generation-topic" aria-invalid={Boolean(generationError && selectedTopicId !== OTHER_TOPIC_OPTION)} aria-describedby={generationError && selectedTopicId !== OTHER_TOPIC_OPTION ? "generation-topic-help generation-topic-error" : "generation-topic-help"}>
                  <SelectValue placeholder="Selecione uma redação salva" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {essayTopicsLoading && <SelectItem value="__topics_loading__" disabled>Carregando redações salvas…</SelectItem>}
                    {sortedEssayTopics.map((essay) => {
                      const duplicate = essayTitleCounts[essay.title.trim().toLocaleLowerCase("pt-BR")] > 1;
                      const createdAt = new Date(essay.created_at);
                      const dateLabel = Number.isNaN(createdAt.getTime())
                        ? "data indisponível"
                        : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(createdAt);
                      return <SelectItem key={essay.id} value={essay.id}>{duplicate ? `${essay.title} · ${dateLabel}` : essay.title}</SelectItem>;
                    })}
                    <SelectItem value={OTHER_TOPIC_OPTION}>Outro tema</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {essayTopicsError ? (
                <div id="generation-topic-help" className="space-y-1 text-sm text-destructive">
                  <p role="alert">Não foi possível carregar suas redações salvas.</p>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onRetryEssayTopics} disabled={essayTopicsLoading || isGenerating || isSaving}>Tentar novamente</Button>
                </div>
              ) : essayTopicsLoading ? (
                <p id="generation-topic-help" className="text-sm text-muted-foreground" role="status" aria-live="polite">Carregando redações salvas…</p>
              ) : essayTopics.length === 0 ? (
                <p id="generation-topic-help" className="text-sm text-muted-foreground">Você ainda não tem redações salvas. Escolha “Outro tema” para digitar o tema.</p>
              ) : (
                <p id="generation-topic-help" className="text-sm text-muted-foreground">Escolha uma redação recente ou digite outro tema.</p>
              )}
              {selectedTopicId === OTHER_TOPIC_OPTION && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="manual-generation-topic">Digite o tema da redação</Label>
                  <Input ref={manualTopicRef} id="manual-generation-topic" value={manualTopic} onChange={(event) => { setManualTopic(event.target.value); setGenerationError(""); }} placeholder="Ex.: acesso à cultura no Brasil" disabled={isGenerating || isSaving} aria-invalid={Boolean(generationError)} aria-describedby={generationError ? "generation-topic-error" : undefined} />
                </div>
              )}
              {generationError && <p id="generation-topic-error" className="text-sm text-destructive" role="alert">{generationError}</p>}
            </div>
            <div className="self-start space-y-2">
              <Label htmlFor="generation-context">Recorte ou contexto (opcional)</Label>
              <Input id="generation-context" value={context} onChange={(event) => setContext(event.target.value)} placeholder="Ex.: juventude e periferias" disabled={isGenerating || isSaving} />
            </div>
            <Button type="button" variant="outline" onClick={generate} disabled={isGenerating || isSaving} className="w-full md:mt-8 md:w-auto">
              <Sparkles className="h-4 w-4" />{isGenerating ? "Gerando…" : "Gerar com IA"}
            </Button>
          </div>
          <p className="sr-only" role="status" aria-live="polite">{isGenerating ? "Gerando sugestão de repertório." : ""}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><BookOpenCheck className="h-4 w-4 text-primary" />Revise seu repertório</CardTitle>
          <p className="text-sm text-muted-foreground">Preencha os campos manualmente ou ajuste a sugestão gerada antes de salvar.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            {field("title", "Título", draft.title, false, "Ex.: O contrato social")}
            {field("category", "Categoria", draft.category, false, "Livro, conceito, lei, filme…")}
          </div>
          {field("summary", "Síntese", draft.summary, true, "Explique a ideia central com suas palavras.")}
          {field("purpose", "Para que serve na argumentação", draft.purpose, true, "Que discussão ou ponto de vista este repertório ajuda a sustentar?")}
          {field("application_example", "Exemplo de aplicação em uma redação", draft.application_example, true, "Mostre como relacionar a referência ao tema sem apenas citá-la.")}
          <div className="grid gap-5 md:grid-cols-2">
            {field("themes", "Temas relacionados (separe por vírgula ou linha)", themesText, true, "Educação, cidadania, desigualdade")}
            {field("niches", "Recortes e nichos (separe por vírgula ou linha)", nichesText, true, "Juventude, periferias, políticas públicas")}
          </div>
          <section aria-labelledby="reference-title" className="space-y-4 border-t pt-5">
            <div>
              <h3 id="reference-title" className="font-medium">Referência para conferência</h3>
              <p className="text-sm text-muted-foreground">Confira os dados em uma fonte confiável antes de usar na redação.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {field("source_title", "Obra ou fonte", draft.source_title ?? "", false, "Título da obra, documento ou fonte")}
              {field("source_author", "Autor ou instituição", draft.source_author ?? "", false, "Nome do autor ou instituição")}
              {field("source_year", "Ano ou período", draft.source_year ?? "", false, "Ex.: 1762 ou década de 1960")}
              {field("source_url", "Link para consulta", draft.source_url ?? "", false, "https://")}
            </div>
          </section>
        </CardContent>
      </Card>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Voltar à biblioteca</Button>
        <Button type="submit" disabled={isSaving || isGenerating}>{isSaving ? "Salvando…" : "Salvar repertório"}</Button>
      </div>
    </form>
  );
}
