import React, { useState, useMemo } from "react";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Info, CheckCircle2, ArrowRight } from "lucide-react";

export interface AnnotatedSnippet {
  competency: 1 | 2 | 3 | 4 | 5;
  type?: string;
  snippet: string;
  suggestion?: string;
  explanation?: string;
}

interface AnnotatedEssayContentProps {
  content: string;
  snippets?: AnnotatedSnippet[];
}

const COMPETENCY_CONFIG = {
  1: {
    label: "C1: Norma Culta",
    shortLabel: "C1",
    highlightClass: "bg-rose-500/20 text-rose-950 dark:text-rose-200 border-b-2 border-rose-500 cursor-pointer rounded-sm px-1 transition-colors hover:bg-rose-500/30",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
  2: {
    label: "C2: Repertório Sociocultural",
    shortLabel: "C2",
    highlightClass: "bg-purple-500/20 text-purple-950 dark:text-purple-200 border-b-2 border-purple-500 cursor-pointer rounded-sm px-1 transition-colors hover:bg-purple-500/30",
    badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  },
  3: {
    label: "C3: Argumentação & Projeto",
    shortLabel: "C3",
    highlightClass: "bg-blue-500/20 text-blue-950 dark:text-blue-200 border-b-2 border-blue-500 cursor-pointer rounded-sm px-1 transition-colors hover:bg-blue-500/30",
    badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  4: {
    label: "C4: Coesão & Conectivos",
    shortLabel: "C4",
    highlightClass: "bg-amber-500/20 text-amber-950 dark:text-amber-200 border-b-2 border-amber-500 cursor-pointer rounded-sm px-1 transition-colors hover:bg-amber-500/30",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  5: {
    label: "C5: Proposta de Intervenção",
    shortLabel: "C5",
    highlightClass: "bg-emerald-500/20 text-emerald-950 dark:text-emerald-200 border-b-2 border-emerald-500 cursor-pointer rounded-sm px-1 transition-colors hover:bg-emerald-500/30",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
} as const;

export const AnnotatedEssayContent: React.FC<AnnotatedEssayContentProps> = ({
  content,
  snippets = [],
}) => {
  const [selectedComp, setSelectedComp] = useState<number | "all">("all");

  // Filtra snippets com base na seleção
  const activeSnippets = useMemo(() => {
    if (!snippets || snippets.length === 0) return [];
    if (selectedComp === "all") return snippets;
    return snippets.filter(s => s.competency === selectedComp);
  }, [snippets, selectedComp]);

  // Renderiza o texto intercalando os snippets anotados encontrados
  const renderedText = useMemo(() => {
    if (!content) return null;
    if (activeSnippets.length === 0) {
      return (
        <span className="whitespace-pre-wrap leading-relaxed">
          {content}
        </span>
      );
    }

    // Mapeia posições dos trechos no conteúdo
    interface MatchSegment {
      start: number;
      end: number;
      snippet: AnnotatedSnippet;
    }

    const segments: MatchSegment[] = [];

    activeSnippets.forEach((ann) => {
      if (!ann.snippet) return;
      const target = ann.snippet.trim();
      if (!target) return;

      let startIndex = 0;
      let pos = content.indexOf(target, startIndex);
      // Evita loops infinitos ou duplicatas sobrepostas
      while (pos !== -1) {
        const end = pos + target.length;
        const overlaps = segments.some(s => (pos < s.end && end > s.start));
        if (!overlaps) {
          segments.push({ start: pos, end, snippet: ann });
          break; // pega a primeira ocorrência compatível
        }
        startIndex = pos + 1;
        pos = content.indexOf(target, startIndex);
      }
    });

    // Ordena os segmentos cronologicamente pelo texto
    segments.sort((a, b) => a.start - b.start);

    if (segments.length === 0) {
      return <span className="whitespace-pre-wrap leading-relaxed">{content}</span>;
    }

    const nodes: React.ReactNode[] = [];
    let currentIndex = 0;

    segments.forEach((seg, idx) => {
      // Texto antes do trecho anotado
      if (seg.start > currentIndex) {
        nodes.push(
          <span key={`text-${idx}`}>
            {content.substring(currentIndex, seg.start)}
          </span>
        );
      }

      const conf = COMPETENCY_CONFIG[seg.snippet.competency as keyof typeof COMPETENCY_CONFIG] || COMPETENCY_CONFIG[1];

      // Trecho com Tooltip interativo
      nodes.push(
        <TooltipProvider key={`ann-${idx}`} delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <mark className={conf.highlightClass}>
                {content.substring(seg.start, seg.end)}
              </mark>
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              align="center"
              className="max-w-sm p-3 bg-popover text-popover-foreground border border-border shadow-xl rounded-xl space-y-2 z-50 text-left"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
                <Badge variant="outline" className={`text-xs ${conf.badgeClass}`}>
                  {conf.label}
                </Badge>
                {seg.snippet.type && (
                  <span className="text-[11px] text-muted-foreground font-mono uppercase">
                    {seg.snippet.type.replace("_", " ")}
                  </span>
                )}
              </div>

              {seg.snippet.suggestion && (
                <div className="text-xs p-2 rounded-md bg-muted/60 border border-border/50">
                  <div className="flex items-center gap-1.5 text-primary font-medium mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sugestão de Reescrever:</span>
                  </div>
                  <span className="text-foreground font-semibold">
                    "{seg.snippet.suggestion}"
                  </span>
                </div>
              )}

              {seg.snippet.explanation && (
                <p className="text-xs text-foreground/90 leading-relaxed">
                  {seg.snippet.explanation}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      currentIndex = seg.end;
    });

    // Texto final restante
    if (currentIndex < content.length) {
      nodes.push(
        <span key="text-end">
          {content.substring(currentIndex)}
        </span>
      );
    }

    return <div className="whitespace-pre-wrap leading-relaxed">{nodes}</div>;
  }, [content, activeSnippets]);

  return (
    <div className="space-y-4">
      {/* Barra de Filtro e Legenda das Competências */}
      {snippets && snippets.length > 0 && (
        <div className="p-3 rounded-xl bg-muted/30 border border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Filtro de Destaques:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedComp("all")}
              className={`px-2.5 py-1 rounded-lg transition-all font-medium text-xs ${
                selectedComp === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background/80 hover:bg-accent text-muted-foreground"
              }`}
            >
              Todos ({snippets.length})
            </button>

            {([1, 2, 3, 4, 5] as const).map((cNum) => {
              const count = snippets.filter(s => s.competency === cNum).length;
              if (count === 0) return null;
              const conf = COMPETENCY_CONFIG[cNum];

              return (
                <button
                  key={cNum}
                  onClick={() => setSelectedComp(cNum)}
                  className={`px-2.5 py-1 rounded-lg border transition-all font-medium text-xs flex items-center gap-1.5 ${
                    selectedComp === cNum
                      ? `${conf.badgeClass} ring-1 ring-primary`
                      : "bg-background/80 border-border/60 hover:bg-accent text-muted-foreground"
                  }`}
                >
                  <span>{conf.shortLabel}</span>
                  <span className="text-[10px] opacity-80 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Conteúdo Anotado */}
      <div className="p-5 rounded-xl border border-border/60 bg-card text-foreground font-sans text-sm md:text-base leading-relaxed tracking-normal shadow-sm">
        {renderedText}
      </div>

      {snippets && snippets.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic px-1">
          <Info className="w-3.5 h-3.5 text-muted-foreground/70" />
          <span>Passe o cursor ou toque nos trechos grifados para abrir a observação detalhada do corretor.</span>
        </div>
      )}
    </div>
  );
};
