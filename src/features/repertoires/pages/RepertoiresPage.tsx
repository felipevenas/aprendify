import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookMarked, Plus, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { essayService } from "@/features/essays/services/essayService";
import type { Essay } from "@/features/essays/types";
import { RepertoireCard } from "../components/RepertoireCard";
import { RepertoireDetailDialog } from "../components/RepertoireDetailDialog";
import { RepertoireForm } from "../components/RepertoireForm";
import { EMPTY_REPERTOIRE_DRAFT, type RepertoireDraft, type SocioculturalRepertoire } from "../types";
import { matchesRepertoireSearch, toDraft, validateRepertoire } from "../services/repertoireUtils";
import { repertoireService } from "../services/repertoireService";

type ActiveTab = "library" | "create";
type EssayOption = Pick<Essay, "id" | "title" | "created_at">;

export default function RepertoiresPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<SocioculturalRepertoire[]>([]);
  const [loading, setLoading] = useState(true);
  const [essayOptions, setEssayOptions] = useState<EssayOption[]>([]);
  const [essayOptionsLoading, setEssayOptionsLoading] = useState(true);
  const [essayOptionsError, setEssayOptionsError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ActiveTab>("library");
  const [draft, setDraft] = useState<RepertoireDraft>({ ...EMPTY_REPERTOIRE_DRAFT });
  const [draftId, setDraftId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<SocioculturalRepertoire | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SocioculturalRepertoire | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const generationSequence = useRef(0);
  const essayOptionsRequest = useRef(0);
  const essayOptionsAbort = useRef<AbortController | null>(null);

  const loadLibrary = useCallback(async (id: string, signal?: AbortSignal) => {
    setLoadError("");
    setLoading(true);
    try {
      const result = await repertoireService.list(id, signal);
      if (!signal?.aborted) setItems(result);
    } catch (error) {
      if (!signal?.aborted) setLoadError(readError(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const loadEssayOptions = useCallback(async (id: string) => {
    essayOptionsAbort.current?.abort();
    const controller = new AbortController();
    essayOptionsAbort.current = controller;
    const requestId = ++essayOptionsRequest.current;
    setEssayOptionsLoading(true);
    setEssayOptionsError("");
    try {
      const result = await essayService.getEssayOptions(id, controller.signal);
      if (controller.signal.aborted || requestId !== essayOptionsRequest.current) return;
      setEssayOptions(result);
    } catch {
      if (controller.signal.aborted || requestId !== essayOptionsRequest.current) return;
      setEssayOptionsError("Não foi possível carregar suas redações salvas.");
      setEssayOptions([]);
    } finally {
      if (!controller.signal.aborted && requestId === essayOptionsRequest.current) setEssayOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        navigate("/auth", { replace: true });
        return;
      }
      setUserId(data.user.id);
      void loadEssayOptions(data.user.id);
      await loadLibrary(data.user.id, controller.signal);
    })();
    return () => {
      active = false;
      controller.abort();
      essayOptionsRequest.current += 1;
      essayOptionsAbort.current?.abort();
    };
  }, [loadEssayOptions, loadLibrary, navigate]);

  const filteredItems = useMemo(() => items.filter((item) => matchesRepertoireSearch(item, search)), [items, search]);

  const startCreate = () => {
    generationSequence.current += 1;
    setGenerating(false);
    setDraft({ ...EMPTY_REPERTOIRE_DRAFT });
    setDraftId(null);
    setFieldErrors({});
    setActionError("");
    setSuccess("");
    setTab("create");
  };

  const startEdit = (item: SocioculturalRepertoire) => {
    generationSequence.current += 1;
    setGenerating(false);
    setDraft(toDraft({ ...item }, item.origin));
    setDraftId(item.id);
    setFieldErrors({});
    setActionError("");
    setSuccess("");
    setSelected(null);
    setTab("create");
  };

  const updateDraft = (next: RepertoireDraft) => {
    setDraft(next);
    setFieldErrors({});
    setActionError("");
  };

  const requestDelete = (item: SocioculturalRepertoire) => {
    setDeleteError("");
    setPendingDelete(item);
  };

  const generate = async (topic: string, context: string) => {
    const requestSequence = ++generationSequence.current;
    setGenerating(true);
    setActionError("");
    try {
      const result = await repertoireService.generate(topic, context);
      if (requestSequence !== generationSequence.current) return;
      setDraft(toDraft(result));
      setFieldErrors({});
      setSuccess("Sugestão gerada. Revise as informações e salve quando estiver pronta.");
    } catch (error) {
      if (requestSequence !== generationSequence.current) return;
      throw new Error(readError(error));
    } finally {
      if (requestSequence === generationSequence.current) setGenerating(false);
    }
  };

  const changeTab = (value: string) => {
    if (value !== "create") {
      generationSequence.current += 1;
      setGenerating(false);
    }
    setTab(value as ActiveTab);
  };

  const save = async (submittedDraft: RepertoireDraft) => {
    const errors = validateRepertoire(submittedDraft);
    setFieldErrors(errors as Record<string, string>);
    if (Object.keys(errors).length || !userId) return;
    setDraft(submittedDraft);
    setSaving(true);
    setActionError("");
    setSuccess("");
    try {
      const persisted = draftId
        ? await repertoireService.update(draftId, userId, submittedDraft)
        : await repertoireService.create(userId, submittedDraft);
      setItems((current) => [persisted, ...current.filter((item) => item.id !== persisted.id)]);
      setSuccess(draftId ? "Repertório atualizado." : "Repertório salvo na sua biblioteca.");
      setDraft({ ...EMPTY_REPERTOIRE_DRAFT });
      setDraftId(null);
      setTab("library");
    } catch (error) {
      setActionError(readError(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete || !userId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await repertoireService.remove(pendingDelete.id, userId);
      setItems((current) => current.filter((item) => item.id !== pendingDelete.id));
      setSuccess("Repertório excluído.");
      setPendingDelete(null);
    } catch (error) {
      setDeleteError(readError(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="app-layout-container min-h-screen bg-background">
      <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Repertórios socioculturais" description="Estude referências, conecte ideias a temas e prepare argumentos para suas redações." icon={BookMarked}
          actions={tab === "library" ? <Button onClick={startCreate}><Plus />Criar repertório</Button> : undefined} />

        {success && <p className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm" role="status">{success}</p>}
        {actionError && <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{actionError}</p>}

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="mb-6 grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="library">Minha biblioteca</TabsTrigger>
            <TabsTrigger value="create">Criar repertório</TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="space-y-5">
            <div className="relative max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" aria-label="Buscar repertórios" placeholder="Buscar por título, tema ou categoria" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
            </div>
            {loading ? <LibrarySkeleton /> : loadError ? <LoadError message={loadError} onRetry={() => userId && void loadLibrary(userId)} /> : filteredItems.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filteredItems.map((item) => <RepertoireCard key={item.id} repertoire={item} onOpen={setSelected} onEdit={startEdit} onDelete={requestDelete} />)}</div>
            ) : <EmptyLibrary hasItems={items.length > 0} onCreate={startCreate} />}
          </TabsContent>
          <TabsContent value="create">
            <RepertoireForm draft={draft} errors={fieldErrors} isSaving={saving} isGenerating={generating} essayTopics={essayOptions} essayTopicsLoading={essayOptionsLoading} essayTopicsError={essayOptionsError} onRetryEssayTopics={() => userId && void loadEssayOptions(userId)} onChange={updateDraft} onGenerate={generate} onSave={(nextDraft) => void save(nextDraft)} onCancel={() => changeTab("library")} />
          </TabsContent>
        </Tabs>
      </div>
      </main>
      <RepertoireDetailDialog repertoire={selected} onClose={() => setSelected(null)} />
      <DeleteDialog item={pendingDelete} deleting={deleting} error={deleteError} onCancel={() => setPendingDelete(null)} onConfirm={() => void remove()} />
    </div>
  );
}

function LibrarySkeleton() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando biblioteca" aria-busy="true">{[1, 2, 3].map((key) => <div key={key} className="h-64 animate-pulse motion-reduce:animate-none rounded-lg border bg-muted/40" />)}</div>;
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <Card><CardContent className="flex flex-col items-start gap-3 py-8"><p className="text-sm text-destructive" role="alert">{message}</p><Button type="button" variant="outline" onClick={onRetry}>Tentar novamente</Button></CardContent></Card>;
}

function EmptyLibrary({ hasItems, onCreate }: { hasItems: boolean; onCreate: () => void }) {
  return <Card><CardContent className="flex flex-col items-center px-6 py-12 text-center">
    <span className="mb-4 rounded-full bg-muted p-3"><BookMarked className="h-6 w-6 text-primary" /></span>
    <h2 className="text-lg font-semibold">{hasItems ? "Nenhum resultado encontrado" : "Sua biblioteca começa aqui"}</h2>
    <p className="mt-2 max-w-md text-sm text-muted-foreground">{hasItems ? "Tente outro termo de busca ou limpe o campo." : "Crie seus próprios repertórios ou use a IA como ponto de partida para organizar referências."}</p>
    {!hasItems && <Button className="mt-5" onClick={onCreate}><Sparkles />Criar repertório</Button>}
  </CardContent></Card>;
}

function DeleteDialog({ item, deleting, error, onCancel, onConfirm }: { item: SocioculturalRepertoire | null; deleting: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  return <AlertDialog open={Boolean(item)} onOpenChange={(open) => { if (!open && !deleting) onCancel(); }}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Excluir repertório?</AlertDialogTitle><AlertDialogDescription>“{item?.title}” será removido da sua biblioteca.</AlertDialogDescription></AlertDialogHeader>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting} onClick={(event) => { event.preventDefault(); onConfirm(); }}>{deleting ? "Excluindo…" : "Excluir"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function readError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/permission|row-level|rls|42501/i.test(message)) return "Seu acesso não permitiu concluir esta ação. Atualize a página e tente novamente.";
  return message || "Não foi possível concluir a ação. Seu rascunho continua disponível.";
}
