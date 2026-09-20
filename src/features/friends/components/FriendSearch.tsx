import { Check, Clock3, Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SocialProfile } from "../types";
import { getSocialDisplayName, getSocialInitials } from "../socialUtils";

export type SearchRelationship = "friend" | "incoming" | "outgoing" | undefined;

interface FriendSearchProps {
  query: string;
  results: SocialProfile[];
  loading: boolean;
  onQueryChange: (value: string) => void;
  onAdd: (profile: SocialProfile) => void;
  getRelationship: (profileId: string) => SearchRelationship;
}

export function FriendSearch({ query, results, loading, onQueryChange, onAdd, getRelationship }: FriendSearchProps) {
  const showResults = query.trim().length >= 2;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="friend-search" className="text-sm font-medium">Encontre alguém para estudar junto</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="friend-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Nome, username ou e-mail"
          className="pl-9"
          aria-describedby="friend-search-help"
        />
      </div>
      <p id="friend-search-help" className="text-xs text-muted-foreground">O e-mail serve apenas para encontrar a conta e não aparece para outras pessoas.</p>

      {showResults && (
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-2" aria-live="polite">
          {loading ? (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="Buscando usuários">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-5 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            results.map((profile) => {
              const relationship = getRelationship(profile.id);
              const name = getSocialDisplayName(profile.fullName, profile.username);
              const disabled = relationship !== undefined;
              return (
                <div key={profile.id} className="flex items-center gap-3 rounded-lg bg-background p-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">
                    {getSocialInitials(profile.fullName, profile.username)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    {profile.username && <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>}
                  </div>
                  <Button size="sm" variant={disabled ? "secondary" : "outline"} disabled={disabled} onClick={() => onAdd(profile)}>
                    {relationship === "friend" && <Check data-icon="inline-start" aria-hidden="true" />}
                    {relationship === "incoming" && <Clock3 data-icon="inline-start" aria-hidden="true" />}
                    {relationship === "outgoing" && <Loader2 data-icon="inline-start" aria-hidden="true" />}
                    {!relationship && <UserPlus data-icon="inline-start" aria-hidden="true" />}
                    <span className={cn("hidden sm:inline", disabled && "sr-only")}>{relationship === "friend" ? "Amigos" : relationship ? "Pendente" : "Adicionar"}</span>
                    {disabled && <span className="sm:hidden">OK</span>}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
