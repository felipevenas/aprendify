import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Clock3, MessageCircle, RefreshCw, Timer, UserPlus, Users, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import { useFriendsHub } from "../hooks/useFriendsHub";
import { friendsService } from "../services/friendsService";
import { FriendCard } from "../components/FriendCard";
import { FriendSearch, type SearchRelationship } from "../components/FriendSearch";
import { FocusChallengeDialog } from "../components/FocusChallengeDialog";
import type { SocialNotification, SocialProfile } from "../types";
import { getSocialDisplayName, getSocialInitials } from "../socialUtils";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export default function FriendsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { friends, incomingRequests, outgoingRequests, notifications, loading, error, reload } = useFriendsHub();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SocialProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [challengeFriend, setChallengeFriend] = useState<SocialProfile | null>(null);
  const [challengeDuration, setChallengeDuration] = useState<15 | 25 | 50>(25);
  const [challengeSubmitting, setChallengeSubmitting] = useState(false);

  useEffect(() => {
    const challengeTargetId = searchParams.get("desafiar");
    if (!challengeTargetId) return;
    const target = friends.find((friend) => friend.id === challengeTargetId);
    if (!target) return;
    setChallengeFriend(target);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("desafiar");
    setSearchParams(nextParams, { replace: true });
  }, [friends, searchParams, setSearchParams]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await friendsService.searchUsers(normalized);
        if (!cancelled) setSearchResults(results);
      } catch (searchError) {
        if (!cancelled) toast.error(getErrorMessage(searchError, "Não foi possível buscar usuários."));
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const relationships = useMemo(() => {
    const map = new Map<string, SearchRelationship>();
    friends.forEach((friend) => map.set(friend.id, "friend"));
    incomingRequests.forEach((request) => map.set(request.id, "incoming"));
    outgoingRequests.forEach((request) => map.set(request.id, "outgoing"));
    return map;
  }, [friends, incomingRequests, outgoingRequests]);

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      await action();
      await reload();
      toast.success(successMessage);
    } catch (actionError) {
      toast.error(getErrorMessage(actionError, "Não foi possível concluir a ação."));
    }
  };

  const handleCreateChallenge = async () => {
    if (!challengeFriend) return;
    setChallengeSubmitting(true);
    try {
      const challenge = await friendsService.createFocusChallenge(challengeFriend.id, challengeDuration);
      setChallengeFriend(null);
      toast.success("Convite de foco enviado!");
      navigate(`/amigos/desafio/${challenge.id}`);
    } catch (challengeError) {
      toast.error(getErrorMessage(challengeError, "Não foi possível enviar o convite."));
    } finally {
      setChallengeSubmitting(false);
    }
  };

  const handleNotificationClick = async (notification: SocialNotification) => {
    if (!notification.readAt) await friendsService.markNotificationRead(notification.id).catch(() => undefined);
    if (notification.notificationType === "challenge_invite" && notification.entityId) {
      navigate(`/amigos/desafio/${notification.entityId}`);
    } else if (notification.notificationType === "friend_request") {
      document.getElementById("friend-tabs")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="min-h-screen bg-background app-layout-container">
      <Navbar />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Conexões Aprendify</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Amigos</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">Estude acompanhado, troque uma ideia e combine pequenos momentos de foco.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4 text-primary" aria-hidden="true" />
            <span>{friends.length} {friends.length === 1 ? "amigo" : "amigos"}</span>
          </div>
        </header>

        <Card className="border-primary/20 bg-primary/[0.03] shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <FriendSearch query={query} results={searchResults} loading={searchLoading} onQueryChange={setQuery} onAdd={(profile) => void runAction(() => friendsService.sendFriendRequest(profile.id), "Solicitação enviada!")} getRelationship={(profileId) => relationships.get(profileId)} />
          </CardContent>
        </Card>

        {error && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={() => void reload()}><RefreshCw data-icon="inline-start" /> Tentar novamente</Button>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)]">
          <Card id="friend-tabs" className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Sua rede de estudo</CardTitle>
              <CardDescription>Gerencie suas conexões e escolha com quem quer interagir.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="friends">
                <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl p-1">
                  <TabsTrigger value="friends" className="gap-2 rounded-lg py-2.5"><Users className="size-4" aria-hidden="true" /> Amigos</TabsTrigger>
                  <TabsTrigger value="requests" className="gap-2 rounded-lg py-2.5"><UserPlus className="size-4" aria-hidden="true" /> Solicitações {incomingRequests.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{incomingRequests.length}</span>}</TabsTrigger>
                </TabsList>
                <TabsContent value="friends" className="mt-5">
                  {loading ? (
                    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando amigos"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
                  ) : friends.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center" role="status">
                      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><UserPlus className="size-5" aria-hidden="true" /></div>
                      <h2 className="text-base font-semibold">Sua lista ainda está vazia</h2>
                      <p className="max-w-sm text-sm text-muted-foreground">Busque alguém pelo nome, username ou e-mail para começar a estudar junto.</p>
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2" aria-label="Lista de amigos">
                      {friends.map((friend) => (
                        <FriendCard
                          key={friend.id}
                          friend={friend}
                          onChat={() => navigate(`/amigos/conversa/${friend.id}`)}
                          onChallenge={() => setChallengeFriend(friend)}
                          onRemove={() => window.confirm(`Remover ${getSocialDisplayName(friend.fullName, friend.username)} da sua lista?`) && void runAction(() => friendsService.removeFriend(friend.friendshipId ?? ""), "Amizade removida.")}
                          onBlock={() => window.confirm(`Bloquear ${getSocialDisplayName(friend.fullName, friend.username)}?`) && void runAction(() => friendsService.blockUser(friend.id), "Usuário bloqueado.")}
                        />
                      ))}
                    </ul>
                  )}
                </TabsContent>
                <TabsContent value="requests" className="mt-5">
                  <div className="flex flex-col gap-5">
                    <section aria-labelledby="incoming-title">
                      <h2 id="incoming-title" className="mb-2 text-sm font-semibold">Recebidas</h2>
                      {incomingRequests.length === 0 ? <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Nenhuma solicitação nova.</p> : <div className="flex flex-col gap-2">{incomingRequests.map((request) => <RequestRow key={request.friendshipId} request={request} onAccept={() => void runAction(() => friendsService.respondFriendRequest(request.friendshipId, true), "Amizade aceita!")} onDecline={() => void runAction(() => friendsService.respondFriendRequest(request.friendshipId, false), "Solicitação recusada.")} />)}</div>}
                    </section>
                    <section aria-labelledby="outgoing-title">
                      <h2 id="outgoing-title" className="mb-2 text-sm font-semibold">Enviadas</h2>
                      {outgoingRequests.length === 0 ? <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Nenhuma solicitação aguardando resposta.</p> : <div className="flex flex-col gap-2">{outgoingRequests.map((request) => <div key={request.friendshipId} className="flex items-center gap-3 rounded-lg border border-border/60 p-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{getSocialInitials(request.fullName, request.username)}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{getSocialDisplayName(request.fullName, request.username)}</span><Button variant="ghost" size="sm" onClick={() => void runAction(() => friendsService.cancelFriendRequest(request.friendshipId), "Solicitação cancelada.")}><X data-icon="inline-start" /> Cancelar</Button></div>)}</div>}
                    </section>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg"><Bell className="size-5 text-primary" aria-hidden="true" /> Atividade recente</CardTitle>
              <CardDescription>Convites e novidades das suas conexões.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center" role="status">
                  <MessageCircle className="size-8 text-muted-foreground/60" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">Quando algo acontecer, aparecerá aqui.</p>
                </div>
              ) : notifications.slice(0, 6).map((notification) => (
                <button key={notification.id} type="button" onClick={() => void handleNotificationClick(notification)} className="flex items-start gap-3 rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><ActivityIcon type={notification.notificationType} /></span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{notification.actorName}</strong><span className="mt-0.5 block text-xs text-muted-foreground">{notificationText(notification.notificationType)}</span></span>
                  {!notification.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
                </button>
              ))}
              <div className="mt-2 rounded-xl bg-muted/40 p-4">
                <div className="flex items-start gap-3"><Timer className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><div><p className="text-sm font-semibold">Um foco compartilhado?</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Abra o desafio pelo card de um amigo e escolha 15, 25 ou 50 minutos para estudarem juntos.</p></div></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <FocusChallengeDialog friend={challengeFriend} duration={challengeDuration} submitting={challengeSubmitting} onDurationChange={setChallengeDuration} onOpenChange={(open) => !open && setChallengeFriend(null)} onSubmit={() => void handleCreateChallenge()} />
    </div>
  );
}

function RequestRow({ request, onAccept, onDecline }: { request: SocialProfile & { friendshipId: string }; onAccept: () => void; onDecline: () => void }) {
  return <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{getSocialInitials(request.fullName, request.username)}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{getSocialDisplayName(request.fullName, request.username)}</span><div className="flex shrink-0 gap-1"><Button size="sm" onClick={onAccept} aria-label={`Aceitar solicitação de ${getSocialDisplayName(request.fullName, request.username)}`}><Check data-icon="inline-start" /> Aceitar</Button><Button size="sm" variant="ghost" onClick={onDecline} aria-label={`Recusar solicitação de ${getSocialDisplayName(request.fullName, request.username)}`}><X data-icon="inline-start" /> <span className="hidden sm:inline">Recusar</span></Button></div></div>;
}

function ActivityIcon({ type }: { type: SocialNotification["notificationType"] }) {
  if (type === "friend_request" || type === "friend_accepted") return <UserPlus className="size-4" aria-hidden="true" />;
  if (type === "challenge_invite" || type === "challenge_update") return <Timer className="size-4" aria-hidden="true" />;
  return <MessageCircle className="size-4" aria-hidden="true" />;
}

function notificationText(type: SocialNotification["notificationType"]): string {
  if (type === "friend_request") return "enviou uma solicitação de amizade";
  if (type === "friend_accepted") return "aceitou sua solicitação de amizade";
  if (type === "message") return "enviou uma nova mensagem";
  if (type === "challenge_invite") return "enviou um convite de foco";
  return "atualizou um desafio de foco";
}
