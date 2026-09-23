import { BookOpen, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { SocioculturalRepertoire } from "../types";

interface RepertoireCardProps {
  repertoire: SocioculturalRepertoire;
  onOpen: (repertoire: SocioculturalRepertoire) => void;
  onEdit: (repertoire: SocioculturalRepertoire) => void;
  onDelete: (repertoire: SocioculturalRepertoire) => void;
}

export function RepertoireCard({ repertoire, onOpen, onEdit, onDelete }: RepertoireCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Badge variant="secondary" className="max-w-full whitespace-normal break-words">{repertoire.category}</Badge>
          <span className="text-xs text-muted-foreground">{repertoire.origin === "ai" ? "Rascunho com IA" : "Manual"}</span>
        </div>
        <CardTitle className="break-words text-lg leading-snug">{repertoire.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{repertoire.summary}</p>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Temas</p>
          <div className="flex flex-wrap gap-1.5">{repertoire.themes.slice(0, 3).map((theme) => <Badge key={theme} variant="outline">{theme}</Badge>)}</div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-2 border-t pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(repertoire)}><BookOpen className="h-4 w-4" />Ver detalhes</Button>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${repertoire.title}`} onClick={() => onEdit(repertoire)}><Pencil /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label={`Excluir ${repertoire.title}`} onClick={() => onDelete(repertoire)}><Trash2 className="text-destructive" /></Button>
        </div>
      </CardFooter>
    </Card>
  );
}
