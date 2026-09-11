import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { usePomodoro } from "@/contexts/PomodoroContext";
import { Button } from "@/components/ui/button";
import { 
  Play, Pause, RotateCcw, Maximize2, Minimize2, 
  Timer, Coffee, Sparkles, Eye, EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";

export const FloatingPomodoro = () => {
  const location = useLocation();
  const {
    timeLeft,
    totalTime,
    timerActive,
    pomodoroMode,
    toggleTimer,
    resetTimer,
    changePomodoroMode,
    formatTime,
    isExpanded,
    setIsExpanded,
  } = usePomodoro();

  const [isDarkBackground, setIsDarkBackground] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Calcula a opacidade com base no progresso do tempo
  const elapsed = totalTime - timeLeft;
  const progressRatio = elapsed / totalTime;
  
  // Opacidade base de 0.35, chegando a 1.0 no final
  const baseOpacity = 0.35 + 0.65 * progressRatio;
  
  // Piscar sutilmente se estiver nos últimos 30 segundos
  const isEnding = timeLeft <= 30 && timerActive;

  // Só mostra se o timer foi ativado ou modificado (timeLeft < totalTime) E o usuário não está no Dashboard, OU se estiver maximizado
  const showWidget = isExpanded || ((timerActive || timeLeft < totalTime) && location.pathname !== "/dashboard");

  // Prevenir rolagem quando expandido em tela cheia
  useEffect(() => {
    if (isExpanded && showWidget) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isExpanded, showWidget]);

  if (!showWidget) return null;

  // Renderização em Tela Cheia (Maximizada)
  if (isExpanded) {
    return (
      <div className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-between py-12 px-6 animate-fade-in transition-colors duration-500",
        isDarkBackground 
          ? "bg-black text-white" 
          : "bg-background/98 backdrop-blur-xl"
      )}>
        {/* Topo - Fechar / Minimizar */}
        <div className="w-full max-w-3xl flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Aprendify Pomodoro
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDarkBackground(!isDarkBackground)}
              className={cn(
                "rounded-xl flex items-center gap-1.5 hover:bg-muted/50 text-xs font-semibold px-3 py-1.5 transition-colors",
                isDarkBackground ? "text-orange-500 hover:text-orange-400" : "text-muted-foreground hover:text-foreground"
              )}
              title={isDarkBackground ? "Fundo desfocado" : "Fundo 100% escuro (Foco Extremo)"}
            >
              {isDarkBackground ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="hidden sm:inline">{isDarkBackground ? "Fundo Padrão" : "Foco Extremo"}</span>
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsExpanded(false)}
              className="rounded-full hover:bg-muted/50 h-11 w-11"
            >
              <Minimize2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Centro - Cronômetro Gigante */}
        <div className="flex flex-col items-center justify-center flex-1 max-w-xl w-full">
          {/* Badge do Modo */}
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-8 shadow-sm border border-border/50",
            pomodoroMode === "focus" 
              ? "bg-gradient-to-r from-red-500/10 to-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-950" 
              : "bg-gradient-to-r from-blue-500/10 to-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-950"
          )}>
            {pomodoroMode === "focus" ? (
              <>
                <Timer className="h-4.5 w-4.5 text-orange-500 animate-pulse" />
                <span>🔥 Modo Concentração</span>
              </>
            ) : (
              <>
                <Coffee className="h-4.5 w-4.5 text-teal-500" />
                <span>☕ Tempo de Descanso</span>
              </>
            )}
          </div>

          {/* Relógio Digital Gigante */}
          <span className="text-8xl sm:text-9xl font-black font-mono tracking-widest text-foreground select-none drop-shadow-md">
            {formatTime(timeLeft)}
          </span>

          <p className="text-sm text-muted-foreground text-center max-w-xs mt-4">
            {pomodoroMode === "focus" 
              ? "Mantenha o foco. Desative notificações e concentre-se na tarefa atual."
              : "Aproveite para alongar, beber água e descansar a mente."}
          </p>

          {/* Progresso Linear Simples */}
          <div className="w-full bg-muted/60 h-1.5 rounded-full mt-10 overflow-hidden border border-border/20">
            <div 
              className={cn(
                "h-full transition-all duration-1000 rounded-full bg-gradient-to-r",
                pomodoroMode === "focus" ? "from-orange-500 to-red-500" : "from-teal-500 to-blue-500"
              )}
              style={{ width: `${(timeLeft / totalTime) * 100}%` }}
            />
          </div>
        </div>

        {/* Botão e Controles Inferiores */}
        <div className="w-full max-w-md flex flex-col gap-6 items-center">
          {/* Seletor de Modos */}
          <div className="flex bg-muted/40 p-1 rounded-xl border border-border/50 w-full">
            <button
              onClick={() => changePomodoroMode("focus")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                pomodoroMode === "focus" ? "bg-background text-orange-600 dark:text-orange-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Timer className="h-3.5 w-3.5" />
              Foco
            </button>
            <button
              onClick={() => changePomodoroMode("shortBreak")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                pomodoroMode === "shortBreak" ? "bg-background text-teal-600 dark:text-teal-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Coffee className="h-3.5 w-3.5" />
              Pausa Curta
            </button>
            <button
              onClick={() => changePomodoroMode("longBreak")}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5",
                pomodoroMode === "longBreak" ? "bg-background text-teal-600 dark:text-teal-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Coffee className="h-3.5 w-3.5" />
              Pausa Longa
            </button>
          </div>

          {/* Controles de Execução */}
          <div className="flex items-center gap-6">
            <Button
              variant="outline"
              size="icon"
              onClick={resetTimer}
              className="rounded-full w-12 h-12 border-border/50 shadow-sm"
            >
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </Button>

            <Button
              size="lg"
              onClick={toggleTimer}
              className={cn(
                "rounded-full w-20 h-20 flex items-center justify-center p-0 shadow-lg transition-transform hover:scale-105",
                pomodoroMode === "focus" 
                  ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                  : "bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white"
              )}
            >
              {timerActive ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 fill-current ml-1" />}
            </Button>

            <div className="w-12 h-12" /> {/* Espaçador para balancear */}
          </div>
        </div>
      </div>
    );
  }

  // Renderização Minimizada (Widget Flutuante no Canto)
  const strokeDashoffset = 113 - (113 * (timeLeft / totalTime));

  return (
    <div 
      className={cn(
        "fixed bottom-6 right-6 z-40 transition-all duration-300 ease-out select-none",
        isEnding ? "animate-pulse" : ""
      )}
      style={{ opacity: isHovered ? 1.0 : baseOpacity }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="bg-card/85 backdrop-blur-md border border-border/80 shadow-2xl p-2 rounded-2xl flex items-center gap-2.5">
        {/* Indicador de Progresso Circular */}
        <div className="relative w-9 h-9 flex items-center justify-center cursor-pointer" onClick={toggleTimer}>
          <svg className="absolute inset-0 w-full h-full transform -rotate-90">
            <circle 
              cx="18" 
              cy="18" 
              r="16" 
              className="stroke-muted/40" 
              strokeWidth="2.5" 
              fill="transparent" 
            />
            <circle 
              cx="18" 
              cy="18" 
              r="16" 
              className={cn(
                "transition-all duration-300",
                pomodoroMode === "focus" ? "stroke-orange-500" : "stroke-teal-500"
              )} 
              strokeWidth="2.5" 
              fill="transparent" 
              strokeDasharray="113" 
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          {timerActive ? (
            <Pause className="h-3.5 w-3.5 text-foreground relative z-10" />
          ) : (
            <Play className="h-3.5 w-3.5 text-foreground relative z-10 fill-current ml-0.5" />
          )}
        </div>

        {/* Informações de Tempo e Modo */}
        <div className="flex flex-col min-w-[70px]">
          <span className="text-sm font-bold font-mono tracking-wider leading-none text-foreground">
            {formatTime(timeLeft)}
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
            {pomodoroMode === "focus" ? "🔥 Foco" : "☕ Pausa"}
          </span>
        </div>

        {/* Ação de Expandir */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsExpanded(true)}
          className="rounded-xl h-8 w-8 hover:bg-muted/80"
        >
          <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
};
