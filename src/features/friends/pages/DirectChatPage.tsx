import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Send, Timer } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { friendsService } from "../services/friendsService";
import { SocialAvatar } from "../components/SocialAvatar";
import type { FriendMessage, SocialProfile } from "../types";
import { getSocialDisplayName } from "../socialUtils";

export default function DirectChatPage() {
  const navigate = useNavigate();
  const { friendId } = useParams<{ friendId: string }>();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friend, setFriend] = useState<SocialProfile | null>(null);
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChat = useCallback(async () => {
    if (!friendId) return;
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(data.user.id);
      const [friends, nextMessages] = await Promise.all([friendsService.listFriends(), friendsService.listMessages(friendId)]);
      const nextFriend = friends.find((candidate) => candidate.id === friendId) ?? null;
      if (!nextFriend) {
        setError("Essa conversa está disponível apenas entre amigos aceitos.");
        return;
      }
      setFriend(nextFriend);
      setMessages(nextMessages);
      await friendsService.markMessagesRead(friendId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a conversa.");
    } finally {
      setLoading(false);
    }
  }, [friendId, navigate]);

  useEffect(() => {
    void loadChat();
    if (!friendId) return undefined;
    const channel = supabase
      .channel(`friend-chat-${friendId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_messages" }, () => void loadChat())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [friendId, loadChat]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!friendId || !body.trim() || sending) return;
    setSending(true);
    try {
      const message = await friendsService.sendMessage(friendId, body);
      setMessages((current) => current.some((currentMessage) => currentMessage.id === message.id) ? current : [...current, message]);
      setBody("");
    } catch (sendError) {
      toast.error(sendError instanceof Error ? sendError.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  };

  const friendName = useMemo(() => (friend ? getSocialDisplayName(friend.fullName, friend.username) : "Conversa"), [friend]);

  return (
    <div className="min-h-screen bg-background app-layout-container">
      <Navbar />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Button variant="ghost" className="w-fit -ml-2" onClick={() => navigate("/amigos")}><ArrowLeft data-icon="inline-start" /> Voltar para amigos</Button>
        <Card className="flex min-h-[calc(100vh-10rem)] flex-col border-border/60 shadow-sm">
          <CardHeader className="flex-row items-center gap-3 border-b border-border/60">
            {friend && <SocialAvatar fullName={friend.fullName} username={friend.username} isOnline={friend.isOnline} />}
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-lg">{friendName}</CardTitle>
              <CardDescription>{friend?.isOnline ? "Online agora" : "Offline"}</CardDescription>
            </div>
            {friend && <Button variant="outline" size="sm" onClick={() => navigate(`/amigos?desafiar=${friend.id}`)}><Timer data-icon="inline-start" /> Desafiar</Button>}
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
            {loading ? (
              <div className="flex flex-1 flex-col justify-end gap-3" aria-busy="true" aria-label="Carregando conversa"><Skeleton className="h-12 w-2/3" /><Skeleton className="ml-auto h-12 w-1/2" /><Skeleton className="h-12 w-3/5" /></div>
            ) : error ? (
              <div className="flex flex-1 items-center justify-center text-center" role="alert"><p className="max-w-sm text-sm text-muted-foreground">{error}</p></div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center" role="status"><Send className="size-8 text-primary/60" aria-hidden="true" /><p className="text-sm font-medium">Comece a conversa</p><p className="text-xs text-muted-foreground">Uma mensagem curta já pode render uma boa sessão de estudo.</p></div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" aria-live="polite" aria-label="Mensagens da conversa">
                {messages.map((message) => {
                  const own = message.senderId === currentUserId;
                  return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${own ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground"}`}><p className="whitespace-pre-wrap break-words">{message.body}</p><time className={`mt-1 block text-[10px] ${own ? "text-primary-foreground/70" : "text-muted-foreground"}`} dateTime={message.createdAt}>{format(new Date(message.createdAt), "HH:mm", { locale: ptBR })}</time></div></div>;
                })}
              </div>
            )}
            {!error && <form className="flex items-end gap-2 border-t border-border/60 pt-4" onSubmit={handleSubmit}><label htmlFor="message-body" className="sr-only">Mensagem</label><Textarea id="message-body" value={body} onChange={(event) => setBody(event.target.value.slice(0, 1000))} placeholder="Escreva uma mensagem..." rows={2} maxLength={1000} disabled={sending || loading} /><Button type="submit" size="icon" className="size-11 shrink-0" disabled={!body.trim() || sending || loading} aria-label="Enviar mensagem">{sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}</Button></form>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
