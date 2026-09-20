import { MoreHorizontal, MessageCircle, ShieldBan, Timer, UserMinus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SocialProfile } from "../types";
import { getSocialDisplayName, getSocialInitials } from "../socialUtils";

interface FriendCardProps {
  friend: SocialProfile;
  onChat: () => void;
  onChallenge: () => void;
  onRemove: () => void;
  onBlock: () => void;
}

export function FriendCard({ friend, onChat, onChallenge, onRemove, onBlock }: FriendCardProps) {
  const name = getSocialDisplayName(friend.fullName, friend.username);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]">
      <Avatar className="size-11 shrink-0 border border-border/60">
        <AvatarFallback className="bg-primary/10 font-semibold text-primary">{getSocialInitials(friend.fullName, friend.username)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-2 rounded-full", friend.isOnline ? "bg-success" : "bg-muted-foreground/40")} aria-hidden="true" />
          <span>{friend.isOnline ? "Online" : "Offline"}</span>
          {friend.username && <span className="truncate">· @{friend.username}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="size-9" onClick={onChat} aria-label={`Conversar com ${name}`} title="Conversar">
          <MessageCircle className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" className="size-9 text-primary hover:text-primary" onClick={onChallenge} aria-label={`Desafiar ${name}`} title="Desafiar para foco">
          <Timer className="size-4" aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9" aria-label={`Mais ações para ${name}`}>
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRemove}>
              <UserMinus className="mr-2 size-4" aria-hidden="true" /> Remover amizade
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onBlock}>
              <ShieldBan className="mr-2 size-4" aria-hidden="true" /> Bloquear usuário
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
