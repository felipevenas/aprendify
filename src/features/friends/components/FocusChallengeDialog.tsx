import { Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SocialProfile } from "../types";
import { getSocialDisplayName } from "../socialUtils";

interface FocusChallengeDialogProps {
  friend: SocialProfile | null;
  duration: 15 | 25 | 50;
  submitting: boolean;
  onDurationChange: (duration: 15 | 25 | 50) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}

export function FocusChallengeDialog({ friend, duration, submitting, onDurationChange, onOpenChange, onSubmit }: FocusChallengeDialogProps) {
  return (
    <Dialog open={Boolean(friend)} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Timer className="size-5 text-primary" aria-hidden="true" /> Convide para um foco</DialogTitle>
          <DialogDescription>
            Escolha uma sessão curta para estudar com {friend ? getSocialDisplayName(friend.fullName, friend.username) : "seu amigo"}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <p className="text-sm font-medium">Duração da sessão</p>
          <ToggleGroup type="single" value={String(duration)} onValueChange={(value) => value && onDurationChange(Number(value) as 15 | 25 | 50)} className="grid grid-cols-3 gap-2">
            {[15, 25, 50].map((minutes) => (
              <ToggleGroupItem key={minutes} value={String(minutes)} className="h-12 rounded-lg border border-border/60 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                {minutes} min
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">Vocês poderão iniciar e concluir a sessão juntos. Não há ranking nem pontuação.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={!friend || submitting}>
            {submitting && <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />}
            Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
