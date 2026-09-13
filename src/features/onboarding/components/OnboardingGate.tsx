import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, Clock3, GraduationCap, Loader2, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type OnboardingData = {
  tempo_estudo: string;
  media_atual: string;
  curso_pretendido: string;
  faculdade_desejada: string;
  maiores_dificuldades: string[];
};

const steps = ["Seu ritmo", "Seu momento", "Seu objetivo", "Onde focar"];
const studyTimeOptions = ["Ainda não comecei", "Até 3h por semana", "4 a 7h por semana", "8 a 14h por semana", "Mais de 14h por semana"];
const averageOptions = ["Ainda não sei", "Abaixo de 500", "500 a 650", "651 a 750", "Acima de 750"];
const courseOptions = ["Medicina", "Direito", "Engenharias", "Psicologia", "Enfermagem", "Ainda estou decidindo"];
const difficultyOptions = ["Linguagens", "Matemática", "Ciências Humanas", "Ciências da Natureza", "Redação"];

const initialData: OnboardingData = { tempo_estudo: "", media_atual: "", curso_pretendido: "", faculdade_desejada: "", maiores_dificuldades: [] };

function ChoiceCard({ label, selected, onClick, icon }: { label: string; selected: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn("group flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 text-left transition-all hover:border-primary/60 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "border-primary bg-primary/10 text-primary shadow-sm")}>
      <span className="flex items-center gap-3 text-sm font-medium">{icon && <span className={cn("text-muted-foreground", selected && "text-primary")}>{icon}</span>}{label}</span>
      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border text-transparent", selected && "border-primary bg-primary text-primary-foreground")}><Check className="h-3.5 w-3.5" /></span>
    </button>
  );
}

export function OnboardingGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "complete" | "required" | "error">("loading");
  const [step, setStep] = useState(0);
  const [data, setData] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session) { setStatus("complete"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("primeiro_acesso").eq("id", session.user.id).single();
      if (!active) return;
      if (profileError) {
        // Permite que usuários existentes continuem acessando enquanto a
        // migração do onboarding ainda não foi aplicada no banco remoto.
        // Assim, uma coluna ausente não transforma um login válido em erro.
        if (profileError.code === "42703") { setStatus("complete"); return; }
        setError("Não conseguimos carregar seu perfil. Tente novamente."); setStatus("error"); return;
      }
      setStatus(profile?.primeiro_acesso ? "required" : "complete");
    };
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const update = (patch: Partial<OnboardingData>) => setData((current) => ({ ...current, ...patch }));
  const canContinue = step === 0 ? !!data.tempo_estudo : step === 1 ? !!data.media_atual : step === 2 ? !!data.curso_pretendido && data.faculdade_desejada.trim().length >= 2 : data.maiores_dificuldades.length > 0;

  const next = async () => {
    if (!canContinue) return;
    if (step < steps.length - 1) { setStep((current) => current + 1); return; }
    setSaving(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sua sessão expirou. Atualize a página para entrar novamente."); setSaving(false); return; }
    const { error: saveError } = await supabase.from("profiles").update({ ...data, primeiro_acesso: false }).eq("id", user.id);
    if (saveError) { setError("Não foi possível salvar suas respostas. Tente novamente."); setSaving(false); return; }
    setStatus("complete"); setSaving(false);
  };

  if (status === "loading") return <div className="flex min-h-screen items-center justify-center bg-background" aria-busy="true"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Carregando seu perfil</span></div>;
  if (status === "complete") return <>{children}</>;
  if (status === "error") return <main className="flex min-h-screen items-center justify-center p-6"><div role="alert" className="max-w-sm space-y-4 text-center"><h1 className="text-xl font-semibold">Quase lá</h1><p className="text-sm text-muted-foreground">{error}</p><Button onClick={() => window.location.reload()}>Tentar novamente</Button></div></main>;

  const progress = ((step + 1) / steps.length) * 100;
  return <main className="min-h-screen bg-gradient-to-b from-primary/[0.06] via-background to-background px-4 py-6 sm:px-6 sm:py-10" aria-labelledby="onboarding-title">
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
      <section className="w-full overflow-hidden rounded-2xl border bg-card shadow-xl">
        <div className="border-b bg-card px-5 pb-5 pt-6 sm:px-10 sm:pt-8">
          <div className="mb-6 flex items-center justify-between gap-4"><div className="flex items-center gap-2 text-primary"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><BookOpen className="h-5 w-5" /></span><span className="font-semibold">Aprendify</span></div><span className="text-xs font-medium text-muted-foreground">Etapa {step + 1} de {steps.length}</span></div>
          <Progress value={progress} className="h-2" aria-label={`Progresso: etapa ${step + 1} de ${steps.length}`} />
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">{steps.map((item, index) => <span key={item} className={cn(index <= step && "font-semibold text-primary")}>{item}</span>)}</div>
        </div>
        <div className="px-5 py-7 sm:px-10 sm:py-10">
          <AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
            {step === 0 && <div className="space-y-6"><div><p className="mb-2 text-sm font-medium text-primary">Vamos personalizar seu começo</p><h1 id="onboarding-title" className="text-2xl sm:text-3xl">Quanto tempo você consegue estudar?</h1><p className="mt-2 text-sm text-muted-foreground">Não existe resposta certa. Isso ajuda a montar metas que cabem na sua rotina.</p></div><div className="grid gap-3 sm:grid-cols-2">{studyTimeOptions.map((option, index) => <ChoiceCard key={option} label={option} selected={data.tempo_estudo === option} onClick={() => update({ tempo_estudo: option })} icon={index === 0 ? <Target className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />} />)}</div></div>}
            {step === 1 && <div className="space-y-6"><div><p className="mb-2 text-sm font-medium text-primary">Sem pressão, é só um ponto de partida</p><h1 id="onboarding-title" className="text-2xl sm:text-3xl">Como está seu desempenho hoje?</h1><p className="mt-2 text-sm text-muted-foreground">Escolha a faixa mais próxima da sua média nos simulados ou provas.</p></div><div className="grid gap-3 sm:grid-cols-2">{averageOptions.map((option) => <ChoiceCard key={option} label={option} selected={data.media_atual === option} onClick={() => update({ media_atual: option })} />)}</div></div>}
            {step === 2 && <div className="space-y-6"><div><p className="mb-2 text-sm font-medium text-primary">Um objetivo deixa o estudo mais claro</p><h1 id="onboarding-title" className="text-2xl sm:text-3xl">O que você quer conquistar?</h1><p className="mt-2 text-sm text-muted-foreground">Conte para a gente qual caminho você está mirando.</p></div><div className="space-y-2"><Label>Curso pretendido</Label><div className="grid gap-3 sm:grid-cols-2">{courseOptions.map((option) => <ChoiceCard key={option} label={option} selected={data.curso_pretendido === option} onClick={() => update({ curso_pretendido: option })} icon={<GraduationCap className="h-4 w-4" />} />)}</div></div><div className="space-y-2"><Label htmlFor="faculdade">Faculdade desejada</Label><Input id="faculdade" value={data.faculdade_desejada} onChange={(event) => update({ faculdade_desejada: event.target.value })} placeholder="Ex.: ENEM, Fuvest, universidade específica..." maxLength={120} /></div></div>}
            {step === 3 && <div className="space-y-6"><div><p className="mb-2 text-sm font-medium text-primary">Vamos priorizar o que mais importa</p><h1 id="onboarding-title" className="text-2xl sm:text-3xl">Em quais áreas você sente mais dificuldade?</h1><p className="mt-2 text-sm text-muted-foreground">Pode escolher mais de uma. Você poderá ajustar isso depois.</p></div><div className="grid gap-3 sm:grid-cols-2">{difficultyOptions.map((option) => <ChoiceCard key={option} label={option} selected={data.maiores_dificuldades.includes(option)} onClick={() => update({ maiores_dificuldades: data.maiores_dificuldades.includes(option) ? data.maiores_dificuldades.filter((item) => item !== option) : [...data.maiores_dificuldades, option] })} />)}</div></div>}
          </motion.div></AnimatePresence>
          {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
          <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5"><Button type="button" variant="ghost" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || saving}><ChevronLeft className="h-4 w-4" />Voltar</Button><Button type="button" onClick={() => void next()} disabled={!canContinue || saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</> : <>{step === steps.length - 1 ? "Começar a estudar" : "Continuar"}<ChevronRight className="h-4 w-4" /></>}</Button></div>
        </div>
      </section>
    </div>
  </main>;
}
