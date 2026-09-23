import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SocioculturalRepertoire } from "../types";

export function RepertoireDetailDialog({
  repertoire,
  onClose,
}: {
  repertoire: SocioculturalRepertoire | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(repertoire)} onOpenChange={(open) => { if (!open) onClose(); }}>
      {repertoire && <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="max-w-full whitespace-normal break-words">{repertoire.category}</Badge>
            <span className="text-xs text-muted-foreground">{repertoire.origin === "ai" ? "Criado com apoio de IA" : "Criado manualmente"}</span>
          </div>
          <DialogTitle className="break-words text-xl">{repertoire.title}</DialogTitle>
          <DialogDescription>{repertoire.summary}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <section><h3 className="mb-1 font-medium">Para que serve</h3><p className="text-sm leading-relaxed text-muted-foreground">{repertoire.purpose}</p></section>
          <section><h3 className="mb-1 font-medium">Exemplo de aplicação</h3><p className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm leading-relaxed">{repertoire.application_example}</p></section>
          <TagSection title="Temas relacionados" items={repertoire.themes} />
          <TagSection title="Recortes e nichos" items={repertoire.niches} />
          <section className="border-t pt-4">
            <h3 className="mb-2 font-medium">Referência para conferência</h3>
            {repertoire.source_title || repertoire.source_author || repertoire.source_year || repertoire.source_url ? (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="break-words">{[repertoire.source_title, repertoire.source_author, repertoire.source_year].filter(Boolean).join(" · ")}</p>
                {repertoire.source_url && <a className="inline-flex items-center gap-1 text-primary underline underline-offset-4" href={repertoire.source_url} target="_blank" rel="noreferrer">Consultar fonte <ExternalLink className="h-3 w-3" /></a>}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhuma referência foi registrada. Confirme os dados em uma fonte confiável antes de usar.</p>}
            <p className="mt-2 text-xs text-muted-foreground">Confira a referência e adapte a relação ao tema da proposta.</p>
          </section>
        </div>
        <div className="flex justify-end"><Button type="button" variant="outline" onClick={onClose}>Fechar</Button></div>
      </DialogContent>}
    </Dialog>
  );
}

function TagSection({ title, items }: { title: string; items: string[] }) {
  return <section><h3 className="mb-2 font-medium">{title}</h3>{items.length ? <div className="flex flex-wrap gap-2">{items.map((item) => <Badge key={item} variant="outline" className="max-w-full whitespace-normal break-words">{item}</Badge>)}</div> : <p className="text-sm text-muted-foreground">Nenhum item registrado.</p>}</section>;
}
