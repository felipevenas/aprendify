import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { 
  Calculator, Sparkles, TrendingUp, CheckCircle2, AlertCircle, 
  Sliders, GraduationCap, Target, Save, Check, Loader2, RotateCcw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { estimateAreaTRI } from "@/features/simulados/services/calculateTRI";

interface TRICalculatorWeights {
  linguagens: number;
  humanas: number;
  natureza: number;
  matematica: number;
  redacao: number;
}

interface TRICalculatorParams {
  targetName: string;
  cutoffScore: number;
  weights: TRICalculatorWeights;
  linguagensHits: number;
  humanasHits: number;
  naturezaHits: number;
  matematicaHits: number;
  redacaoScore: number;
  updatedAt: string;
}

const DEFAULT_PARAMS: Omit<TRICalculatorParams, "updatedAt"> = {
  targetName: "Meu Curso Alvo",
  cutoffScore: 760,
  weights: {
    linguagens: 2,
    humanas: 1.5,
    natureza: 3,
    matematica: 3,
    redacao: 2,
  },
  linguagensHits: 32,
  humanasHits: 34,
  naturezaHits: 28,
  matematicaHits: 31,
  redacaoScore: 880,
};

export const TRICalculatorPage: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  // Estado dos acertos por área (0 a 45)
  const [linguagensHits, setLinguagensHits] = useState<number>(DEFAULT_PARAMS.linguagensHits);
  const [humanasHits, setHumanasHits] = useState<number>(DEFAULT_PARAMS.humanasHits);
  const [naturezaHits, setNaturezaHits] = useState<number>(DEFAULT_PARAMS.naturezaHits);
  const [matematicaHits, setMatematicaHits] = useState<number>(DEFAULT_PARAMS.matematicaHits);
  const [redacaoScore, setRedacaoScore] = useState<number>(DEFAULT_PARAMS.redacaoScore);

  // Informações do Edital Próprio do Estudante
  const [targetName, setTargetName] = useState<string>(DEFAULT_PARAMS.targetName);
  const [cutoffScore, setCutoffScore] = useState<number>(DEFAULT_PARAMS.cutoffScore);
  const [weights, setWeights] = useState<TRICalculatorWeights>(DEFAULT_PARAMS.weights);

  // Carrega parâmetros salvos do usuário autenticado
  useEffect(() => {
    const loadUserParams = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const storageKey = `aprendify_tri_goals_${user.id}`;
        const localData = localStorage.getItem(storageKey);
        let parsed: TRICalculatorParams | null = null;

        if (localData) {
          try {
            parsed = JSON.parse(localData);
          } catch (err) {
            console.warn("Erro ao fazer parse dos dados locais da calculadora:", err);
          }
        }

        // Se não tiver localmente, recupera da nuvem do Supabase
        if (!parsed && user.user_metadata?.tri_goals) {
          parsed = user.user_metadata.tri_goals;
        }

        if (parsed) {
          if (typeof parsed.targetName === "string") setTargetName(parsed.targetName);
          if (typeof parsed.cutoffScore === "number") setCutoffScore(parsed.cutoffScore);
          if (parsed.weights) setWeights(parsed.weights);
          if (typeof parsed.linguagensHits === "number") setLinguagensHits(parsed.linguagensHits);
          if (typeof parsed.humanasHits === "number") setHumanasHits(parsed.humanasHits);
          if (typeof parsed.naturezaHits === "number") setNaturezaHits(parsed.naturezaHits);
          if (typeof parsed.matematicaHits === "number") setMatematicaHits(parsed.matematicaHits);
          if (typeof parsed.redacaoScore === "number") setRedacaoScore(parsed.redacaoScore);
          if (parsed.updatedAt) setLastSaved(parsed.updatedAt);
        }
      } catch (e) {
        console.error("Erro ao carregar parâmetros da calculadora:", e);
      } finally {
        setHasLoaded(true);
      }
    };

    loadUserParams();
  }, []);

  // Função para salvar parâmetros (manual ou automática)
  const saveParams = useCallback(async (showToast = true) => {
    if (!userId) return;
    setIsSaving(true);

    const payload: TRICalculatorParams = {
      targetName,
      cutoffScore,
      weights,
      linguagensHits,
      humanasHits,
      naturezaHits,
      matematicaHits,
      redacaoScore,
      updatedAt: new Date().toISOString(),
    };

    try {
      // 1. Salva em LocalStorage para acesso instantâneo
      localStorage.setItem(`aprendify_tri_goals_${userId}`, JSON.stringify(payload));
      setLastSaved(payload.updatedAt);

      // 2. Persiste na conta do usuário no Supabase
      await supabase.auth.updateUser({
        data: { tri_goals: payload },
      });

      if (showToast) {
        toast.success("Metas e parâmetros salvos com sucesso!");
      }
    } catch (err: unknown) {
      console.error("Erro ao salvar parâmetros da calculadora:", err);
      if (showToast) {
        toast.error("Erro ao sincronizar parâmetros.");
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    userId, targetName, cutoffScore, weights,
    linguagensHits, humanasHits, naturezaHits, matematicaHits, redacaoScore
  ]);

  // Auto-save inteligente após 1.5s de inatividade
  useEffect(() => {
    if (!hasLoaded || !userId) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      saveParams(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    targetName, cutoffScore, weights,
    linguagensHits, humanasHits, naturezaHits, matematicaHits, redacaoScore,
    hasLoaded, userId, saveParams
  ]);

  // Resetar para os padrões
  const handleResetDefaults = () => {
    setTargetName(DEFAULT_PARAMS.targetName);
    setCutoffScore(DEFAULT_PARAMS.cutoffScore);
    setWeights(DEFAULT_PARAMS.weights);
    setLinguagensHits(DEFAULT_PARAMS.linguagensHits);
    setHumanasHits(DEFAULT_PARAMS.humanasHits);
    setNaturezaHits(DEFAULT_PARAMS.naturezaHits);
    setMatematicaHits(DEFAULT_PARAMS.matematicaHits);
    setRedacaoScore(DEFAULT_PARAMS.redacaoScore);
    toast.info("Valores padrão restaurados.");
  };

  // Estimativa TRI por área baseada nas curvas históricas reais do INEP
  const triScores = useMemo(() => {
    const ling = estimateAreaTRI("linguagens", linguagensHits, 45);
    const hum = estimateAreaTRI("humanas", humanasHits, 45);
    const nat = estimateAreaTRI("natureza", naturezaHits, 45);
    const mat = estimateAreaTRI("matematica", matematicaHits, 45);
    const red = redacaoScore;

    return { ling, hum, nat, mat, red };
  }, [linguagensHits, humanasHits, naturezaHits, matematicaHits, redacaoScore]);

  // Média ponderada pelo edital configurado
  const sisuAverage = useMemo(() => {
    const totalWeights = 
      weights.linguagens + 
      weights.humanas + 
      weights.natureza + 
      weights.matematica + 
      weights.redacao;
    
    if (totalWeights <= 0) return 0;

    const weightedSum = 
      (triScores.ling * weights.linguagens) +
      (triScores.hum * weights.humanas) +
      (triScores.nat * weights.natureza) +
      (triScores.mat * weights.matematica) +
      (triScores.red * weights.redacao);

    return Math.round((weightedSum / totalWeights) * 10) / 10;
  }, [triScores, weights]);

  // Status de aprovação em relação à meta
  const diff = Math.round((sisuAverage - cutoffScore) * 10) / 10;
  
  const statusConfig = useMemo(() => {
    if (diff >= 15) {
      return {
        label: "Excelente Chance de Aprovação",
        badgeClass: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        message: "Sua média estimada supera a nota de corte com margem confortável!",
        icon: CheckCircle2,
        color: "text-emerald-500",
      };
    } else if (diff >= 0) {
      return {
        label: "Na Faixa de Corte (Competitivo)",
        badgeClass: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
        message: "Sua nota atinge a meta estipulada. Mantenha a constância nos estudos para garantir a vaga.",
        icon: TrendingUp,
        color: "text-blue-500",
      };
    } else if (diff >= -20) {
      return {
        label: "Quase lá (Ajuste Fino)",
        badgeClass: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
        message: `Faltam apenas ${Math.abs(diff)} pontos na média ponderada. Priorize as áreas com maiores pesos para fechar a lacuna!`,
        icon: AlertCircle,
        color: "text-amber-500",
      };
    } else {
      return {
        label: "Abaixo da Meta",
        badgeClass: "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30",
        message: `Diferença de ${Math.abs(diff)} pontos para a nota de corte. Foque na resolução de questões e correção de erros.`,
        icon: AlertCircle,
        color: "text-rose-500",
      };
    }
  }, [diff]);

  return (
    <div className="min-h-screen bg-background app-layout-container">
      {/* Sidebar e Topbar da aplicação */}
      <Navbar />

      {/* Conteúdo Principal alinhado à direita da sidebar */}
      <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header da Página */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
                <Calculator className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    Calculadora de Metas TRI & SISU
                  </h1>
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                    Escala INEP
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Simule sua nota estimada por área e calcule a média ponderada com os pesos do seu edital
                </p>
              </div>
            </div>

            {/* Ações de Persistência e Salvar Metas */}
            <div className="flex flex-wrap items-center gap-3">
              {lastSaved && (
                <div className="text-right hidden sm:block">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvo na nuvem</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    Último salvamento: {new Date(lastSaved).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleResetDefaults}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="Restaurar valores padrão da calculadora"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Restaurar Padrão</span>
              </Button>

              <Button
                onClick={() => saveParams(true)}
                disabled={isSaving}
                size="sm"
                className="gap-2 shadow-sm"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSaving ? "Salvando..." : "Salvar Metas"}</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Coluna Esquerda: Configuração do Edital e Sliders (7 Colunas) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Card de Configuração do Edital Próprio */}
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Parâmetros do Seu Edital & Meta
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Insira a nota de corte alvo e os pesos estipulados no Termo de Adesão da sua universidade.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tri-target-name" className="text-xs font-semibold">Curso / Instituição Alvo</Label>
                      <Input
                        id="tri-target-name"
                        type="text"
                        value={targetName}
                        onChange={(e) => setTargetName(e.target.value)}
                        className="mt-1"
                        placeholder="Ex: Medicina - UFRJ ou Direito - USP"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tri-cutoff-score" className="text-xs font-semibold">Nota de Corte Alvo (pontos)</Label>
                      <Input
                        id="tri-cutoff-score"
                        type="number"
                        step="0.1"
                        value={cutoffScore}
                        onChange={(e) => setCutoffScore(parseFloat(e.target.value) || 0)}
                        className="mt-1 font-mono"
                        placeholder="Ex: 780.5"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-primary" />
                        Pesos por Área de Conhecimento
                      </Label>
                      <span className="text-[11px] text-muted-foreground">Valores de 1x a 5x</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-5 sm:gap-2">
                      {(["linguagens", "humanas", "natureza", "matematica", "redacao"] as const).map((areaKey) => {
                        const labels: Record<string, string> = {
                          linguagens: "Linguagens",
                          humanas: "Humanas",
                          natureza: "Natureza",
                          matematica: "Matemática",
                          redacao: "Redação",
                        };
                        return (
                          <div key={areaKey} className="text-center">
                            <Label htmlFor={`tri-weight-${areaKey}`} className="text-[11px] font-medium text-muted-foreground block mb-1 break-words">
                              {labels[areaKey]}
                            </Label>
                            <Input
                              id={`tri-weight-${areaKey}`}
                              type="number"
                              min="1"
                              max="5"
                              step="0.5"
                              value={weights[areaKey]}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1;
                                setWeights(prev => ({ ...prev, [areaKey]: val }));
                              }}
                              className="text-center font-mono text-sm h-9 font-semibold"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sliders das 4 Áreas + Redação */}
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Simulação de Acertos por Prova</CardTitle>
                    <span className="text-xs text-muted-foreground">Arraste para ajustar</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  {/* Linguagens */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">Linguagens e Códigos</span>
                        <span className="text-xs text-muted-foreground ml-2">45 questões • peso {weights.linguagens}x</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-primary">{linguagensHits}/45</span>
                        <span className="text-xs text-muted-foreground ml-2">TRI ~{triScores.ling} pts</span>
                      </div>
                    </div>
                    <Slider
                      value={[linguagensHits]}
                      min={0}
                      max={45}
                      step={1}
                      onValueChange={(val) => setLinguagensHits(val[0])}
                      className="py-1"
                    />
                  </div>

                  {/* Ciências Humanas */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">Ciências Humanas</span>
                        <span className="text-xs text-muted-foreground ml-2">45 questões • peso {weights.humanas}x</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-primary">{humanasHits}/45</span>
                        <span className="text-xs text-muted-foreground ml-2">TRI ~{triScores.hum} pts</span>
                      </div>
                    </div>
                    <Slider
                      value={[humanasHits]}
                      min={0}
                      max={45}
                      step={1}
                      onValueChange={(val) => setHumanasHits(val[0])}
                      className="py-1"
                    />
                  </div>

                  {/* Ciências da Natureza */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">Ciências da Natureza</span>
                        <span className="text-xs text-muted-foreground ml-2">45 questões • peso {weights.natureza}x</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-primary">{naturezaHits}/45</span>
                        <span className="text-xs text-muted-foreground ml-2">TRI ~{triScores.nat} pts</span>
                      </div>
                    </div>
                    <Slider
                      value={[naturezaHits]}
                      min={0}
                      max={45}
                      step={1}
                      onValueChange={(val) => setNaturezaHits(val[0])}
                      className="py-1"
                    />
                  </div>

                  {/* Matemática */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">Matemática e suas Tecnologias</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400">
                          peso {weights.matematica}x
                        </Badge>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-primary">{matematicaHits}/45</span>
                        <span className="text-xs text-muted-foreground ml-2">TRI ~{triScores.mat} pts</span>
                      </div>
                    </div>
                    <Slider
                      value={[matematicaHits]}
                      min={0}
                      max={45}
                      step={1}
                      onValueChange={(val) => setMatematicaHits(val[0])}
                      className="py-1"
                    />
                  </div>

                  {/* Redação */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">Redação ENEM</span>
                        <span className="text-xs text-muted-foreground ml-2">0 a 1000 pontos • peso {weights.redacao}x</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-base text-primary">{redacaoScore} pts</span>
                      </div>
                    </div>
                    <Slider
                      value={[redacaoScore]}
                      min={0}
                      max={1000}
                      step={20}
                      onValueChange={(val) => setRedacaoScore(val[0])}
                      className="py-1"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Direita: Resultados e Termômetro SISU (5 Colunas) */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-border/60 shadow-md relative overflow-hidden bg-gradient-to-br from-card to-card/80">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-emerald-500 to-indigo-500" />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs uppercase tracking-wider font-semibold">
                      Média Ponderada SISU
                    </CardDescription>
                    {targetName && (
                      <span className="text-xs font-medium text-muted-foreground truncate max-w-[180px]">
                        {targetName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <div className="text-4xl font-extrabold tracking-tight text-foreground font-mono">
                      {sisuAverage}
                      <span className="text-sm font-sans font-normal text-muted-foreground ml-1.5">pts</span>
                    </div>
                    <Badge className={statusConfig.badgeClass}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-2">
                  {/* Comparação com nota de corte */}
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Nota de Corte Alvo:</span>
                      <span className="font-mono font-semibold">{cutoffScore} pts</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Comparativo com a Meta</span>
                        <span className={diff >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                          {diff >= 0 ? `+${diff}` : `${diff}`} pts
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-secondary/80 rounded-full overflow-hidden flex">
                        <div 
                          className={`h-full transition-all duration-300 ${diff >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(Math.max((sisuAverage / (cutoffScore * 1.05)) * 100, 15), 100)}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {statusConfig.message}
                    </p>
                  </div>

                  {/* Resumo por Área */}
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Detalhamento das Notas TRI
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-background border border-border/60 flex justify-between items-center">
                        <span className="text-muted-foreground">Linguagens:</span>
                        <span className="font-mono font-bold">{triScores.ling}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-background border border-border/60 flex justify-between items-center">
                        <span className="text-muted-foreground">Humanas:</span>
                        <span className="font-mono font-bold">{triScores.hum}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-background border border-border/60 flex justify-between items-center">
                        <span className="text-muted-foreground">Natureza:</span>
                        <span className="font-mono font-bold">{triScores.nat}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-background border border-border/60 flex justify-between items-center">
                        <span className="text-muted-foreground">Matemática:</span>
                        <span className="font-mono font-bold text-primary">{triScores.mat}</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background border border-border/60 flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Redação:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{triScores.red}</span>
                    </div>
                  </div>

                  {/* Nota sobre os dados e metodologia */}
                  <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-primary">
                      <Sparkles className="w-3.5 h-3.5" />
                      Metodologia da Estimativa TRI
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      As notas estimadas por acertos utilizam os parâmetros das notas mínimas e máximas históricas do INEP (Matemática com amplitude superior a 980 pts, e Linguagens atingindo até ~825 pts).
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default TRICalculatorPage;
