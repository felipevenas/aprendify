import React from "react";
import { CheckCircle2, XCircle, ShieldCheck, UserCheck, PlayCircle, Layers, Target, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export interface InterventionElement {
  present: boolean;
  snippet?: string;
  feedback?: string;
}

export interface InterventionChecklistData {
  agent?: InterventionElement;
  action?: InterventionElement;
  mode?: InterventionElement;
  effect?: InterventionElement;
  detail?: InterventionElement;
}

interface InterventionChecklistProps {
  checklist?: InterventionChecklistData | null;
  score?: number;
}

const ELEMENTS_INFO = [
  {
    key: "agent" as const,
    title: "1. Agente",
    subtitle: "Quem executará a ação?",
    icon: UserCheck,
    description: "Órgão, ministério, escola, mídia ou entidade responsável.",
  },
  {
    key: "action" as const,
    title: "2. Ação",
    subtitle: "O que será feito?",
    icon: PlayCircle,
    description: "Medida prática proposta para enfrentar a problemática.",
  },
  {
    key: "mode" as const,
    title: "3. Meio / Modo",
    subtitle: "Como será executado?",
    icon: Layers,
    description: "Recursos, parcerias, canais ou métodos de aplicação.",
  },
  {
    key: "effect" as const,
    title: "4. Efeito / Finalidade",
    subtitle: "Qual o objetivo visado?",
    icon: Target,
    description: "Impacto social esperado com a intervenção.",
  },
  {
    key: "detail" as const,
    title: "5. Detalhamento",
    subtitle: "Especificação de um dos elementos",
    icon: FileText,
    description: "Exemplificação, desdobramento ou especificação adicional.",
  },
];

export const InterventionChecklist: React.FC<InterventionChecklistProps> = ({
  checklist,
  score,
}) => {
  if (!checklist) {
    return null;
  }

  // Contabiliza elementos presentes
  const presentCount = ELEMENTS_INFO.reduce((acc, el) => {
    return acc + (checklist[el.key]?.present ? 1 : 0);
  }, 0);

  const calculatedPoints = presentCount * 40;

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 pb-4 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Checklist Oficial dos 5 Elementos da Proposta (C5)
              </CardTitle>
              <CardDescription className="text-xs">
                Rubrica oficial do INEP para a Proposta de Intervenção Social
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge 
              variant="outline" 
              className={`font-mono text-xs px-2.5 py-1 ${
                presentCount === 5
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : presentCount >= 3
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
              }`}
            >
              {presentCount}/5 Elementos ({score ?? calculatedPoints} pts)
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-3">
        {ELEMENTS_INFO.map((item) => {
          const elData = checklist[item.key];
          const isPresent = elData?.present ?? false;
          const Icon = item.icon;

          return (
            <div
              key={item.key}
              className={`p-3.5 rounded-xl border transition-all ${
                isPresent
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-muted/30 border-border/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-md mt-0.5 ${
                    isPresent 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {item.title}
                      </span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        • {item.subtitle}
                      </span>
                    </div>

                    {/* Trecho citado na redação */}
                    {isPresent && elData?.snippet && (
                      <p className="text-xs font-mono bg-background/80 px-2 py-1 rounded border border-border/40 text-foreground/90">
                        "{elData.snippet}"
                      </p>
                    )}

                    {/* Feedback pontual */}
                    {elData?.feedback && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {elData.feedback}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isPresent ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[11px] font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Presente (+40)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border/60 gap-1 text-[11px]">
                      <XCircle className="w-3 h-3 text-muted-foreground" />
                      Não Identificado
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
