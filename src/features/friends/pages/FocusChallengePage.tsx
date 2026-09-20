import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Loader2, Timer, XCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { friendsService } from "../services/friendsService";
import { canRunChallengeAction, getChallengeStatusLabel } from "../socialUtils";
import type { FocusChallenge, FocusChallengeAction } from "../types";

export default function FocusChallengePage() {
  const navigate = useNavigate();
  const { challengeId } = useParams<{ challengeId: string }>();
  const [challenge, setChallenge] = useState<FocusChallenge | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);

  const loadChallenge = useCallback(async () => {
    if (!challengeId) return;
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth");
        return;
      }
      setUserId(data.user.id);
      const nextChallenge = await friendsService.getFocusChallenge(challengeId);
      if (!nextChallenge) {
        setError("Desafio não encontrado ou não disponível para você.");
        return;
      }
      setChallenge(nextChallenge);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o desafio.");
    } finally {
      setLoading(false);
    }
  }, [challengeId, navigate]);

  useEffect(() => {
    void loadChallenge();
    if (!challengeId) return undefined;
    const channel = supabase
      .channel(`focus-challenge-${challengeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "focus_challenges", filter: `id=eq.${challengeId}` }, () => void loadChallenge())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [challengeId, loadChallenge]);

  useEffect(() => {
    if (challenge?.status !== "active") return undefined;
    const timerId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [challenge?.status]);

  const secondsElapsed = useMemo(() => {
    if (!challenge?.startedAt) return 0;
    return Math.max(0, Math.floor((now - new Date(challenge.startedAt).getTime()) / 1000));
  }, [challenge?.startedAt, now]);
  const totalSeconds = (challenge?.durationMinutes ?? 0) * 60;
  const secondsRemaining = Math.max(0, totalSeconds - secondsElapsed);
  const progress = totalSeconds ? Math.min(100, (secondsElapsed / totalSeconds) * 100) : 0;
  const isCreator = challenge?.creatorId === userId;
  const currentName = isCreator ? challenge?.creatorName : challenge?.inviteeName;
  const otherName = isCreator ? challenge?.inviteeName : challenge?.creatorName;

  const runAction = async (action: FocusChallengeAction) => {
    if (!challenge || !canRunChallengeAction(challenge.status, action)) return;
    setSubmitting(true);
    try {
      const nextChallenge = await friendsService.updateFocusChallenge(challenge.id, action);
      setChallenge(nextChallenge);
      toast.success(action === "complete" ? "Foco concluído!" : "Desafio atualizado.");
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Não foi possível atualizar o desafio.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-background app-layout-container">
      <Navbar />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Button variant="ghost" className="w-fit -ml-2" onClick={() => navigate("/amigos")}><ArrowLeft data-icon="inline-start" /> Voltar para amigos</Button>
        {loading ? <Card className="border-border/60"><CardContent className="flex flex-col gap-4 p-6"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-32 w-full" /><Skeleton className="h-12 w-full" /></CardContent></Card> : error ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm" role="alert">{error}</div> : challenge ? <Card className="overflow-hidden border-border/60 shadow-sm"><CardHeader className="border-b border-border/60 bg-primary/[0.03] text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Timer className="size-6" aria-hidden="true" /></div><CardTitle className="mt-2 text-2xl">Foco compartilhado</CardTitle><CardDescription>{currentName} e {otherName} · {challenge.durationMinutes} minutos</CardDescription></CardHeader><CardContent className="flex flex-col items-center gap-6 p-6 sm:p-10"><div className="flex flex-col items-center gap-2" aria-live="polite"><span className="text-sm font-medium text-muted-foreground">{getChallengeStatusLabel(challenge.status)}</span><span className="font-mono text-6xl font-bold tracking-tight text-foreground sm:text-7xl">{formatTime(secondsRemaining)}</span>{challenge.status === "active" && <Progress value={progress} className="mt-2 h-2 w-56" aria-label={`${Math.round(progress)}% do foco concluído`} />}</div><div className="grid w-full gap-3 sm:grid-cols-2"><ParticipantState label={challenge.creatorName} completed={Boolean(challenge.creatorCompletedAt)} active={challenge.status === "active"} /><ParticipantState label={challenge.inviteeName} completed={Boolean(challenge.inviteeCompletedAt)} active={challenge.status === "active"} /></div><ChallengeActions challenge={challenge} isCreator={Boolean(isCreator)} submitting={submitting} onAction={(action) => void runAction(action)} /></CardContent></Card> : null}
      </main>
    </div>
  );
}

function ParticipantState({ label, completed, active }: { label: string; completed: boolean; active: boolean }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border/60 p-3"><span className={`flex size-9 items-center justify-center rounded-full ${completed ? "bg-success/10 text-success" : active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{completed ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Clock3 className="size-4" aria-hidden="true" />}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{completed ? "Concluiu" : active ? "Em foco" : "Aguardando"}</span></div>;
}

function ChallengeActions({ challenge, isCreator, submitting, onAction }: { challenge: FocusChallenge; isCreator: boolean; submitting: boolean; onAction: (action: FocusChallengeAction) => void }) {
  if (challenge.status === "pending" && !isCreator) return <div className="flex w-full flex-col gap-2 sm:flex-row"><Button className="flex-1" onClick={() => onAction("accept")} disabled={submitting}>{submitting && <Loader2 data-icon="inline-start" className="animate-spin" />} Aceitar convite</Button><Button variant="outline" className="flex-1" onClick={() => onAction("decline")} disabled={submitting}><XCircle data-icon="inline-start" /> Recusar</Button></div>;
  if (challenge.status === "pending" && isCreator) return <Button variant="outline" onClick={() => onAction("cancel")} disabled={submitting}>Cancelar convite</Button>;
  if (challenge.status === "accepted") return <div className="flex w-full flex-col gap-2 sm:flex-row"><Button className="flex-1" onClick={() => onAction("start")} disabled={submitting}>{submitting && <Loader2 data-icon="inline-start" className="animate-spin" />} Começar foco</Button><Button variant="outline" onClick={() => onAction("cancel")} disabled={submitting}>Cancelar</Button></div>;
  if (challenge.status === "active") return <Button className="w-full" onClick={() => onAction("complete")} disabled={submitting}>{submitting && <Loader2 data-icon="inline-start" className="animate-spin" />} Marcar meu foco como concluído</Button>;
  return <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" aria-hidden="true" /> Esta sessão foi encerrada.</p>;
}
