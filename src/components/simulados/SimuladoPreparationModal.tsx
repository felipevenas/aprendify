import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, Clock } from "lucide-react";

interface SimuladoPreparationModalProps {
  open: boolean;
  status: "idle" | "preparing" | "ready" | "error";
  progress: number;
  message: string;
  error: string | null;
  loadedCount?: number;
  targetCount?: number;
  onRetry: () => void;
  onCancel: () => void;
  onContinue: () => void;
}

/**
 * Modal de preparação do simulado
 * Exibe progresso detalhado de carregamento com contagem de questões
 * Garante que todas as questões estejam prontas antes de continuar
 */
export const SimuladoPreparationModal = ({
  open,
  status,
  progress,
  message,
  error,
  loadedCount = 0,
  targetCount = 0,
  onRetry,
  onCancel,
  onContinue,
}: SimuladoPreparationModalProps) => {
  // Ícone baseado no status
  const StatusIcon = () => {
    switch (status) {
      case "preparing":
        return <Loader2 className="h-12 w-12 text-primary animate-spin" />;
      case "ready":
        return <CheckCircle2 className="h-12 w-12 text-green-500" />;
      case "error":
        return <AlertCircle className="h-12 w-12 text-destructive" />;
      default:
        return null;
    }
  };

  // Calcular tempo estimado restante (aproximado)
  const getEstimatedTime = () => {
    if (status !== "preparing" || progress <= 10) return null;
    
    // Assume ~1.5s per page of 50 questions due to rate limiting
    const remainingQuestions = targetCount - loadedCount;
    const pagesRemaining = Math.ceil(remainingQuestions / 50);
    const secondsRemaining = pagesRemaining * 1.5;
    
    if (secondsRemaining < 5) return "Quase lá...";
    if (secondsRemaining < 30) return `~${Math.ceil(secondsRemaining)} segundos restantes`;
    if (secondsRemaining < 120) return `~${Math.ceil(secondsRemaining / 60)} minuto(s) restante(s)`;
    return "Isso pode levar alguns minutos...";
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {status === "preparing" && "Preparando Simulado"}
            {status === "ready" && "Simulado Pronto!"}
            {status === "error" && "Erro na Preparação"}
          </DialogTitle>
          <DialogDescription>
            {status === "preparing" &&
              "Aguarde enquanto carregamos TODAS as questões. Isso garante uma experiência completa sem interrupções."}
            {status === "ready" &&
              "Todas as questões foram carregadas com sucesso. Você pode começar agora!"}
            {status === "error" &&
              "Houve um problema ao carregar as questões. Você pode tentar novamente."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-6">
          {/* Animated Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={status}
            transition={{ duration: 0.3 }}
          >
            <StatusIcon />
          </motion.div>

          {/* Progress section for preparing state */}
          {status === "preparing" && (
            <div className="w-full space-y-3">
              {/* Progress bar */}
              <Progress value={progress} className="h-3" />
              
              {/* Progress details */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{message}</span>
                <span className="font-medium text-primary">
                  {Math.round(progress)}%
                </span>
              </div>

              {/* Question counter */}
              {targetCount > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                  <span className="text-muted-foreground">Questões carregadas:</span>
                  <span className="font-bold text-lg text-primary">
                    {loadedCount}
                  </span>
                  <span className="text-muted-foreground">/ {targetCount}</span>
                </div>
              )}

              {/* Estimated time */}
              {getEstimatedTime() && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{getEstimatedTime()}</span>
                </div>
              )}
            </div>
          )}

          {/* Success message */}
          {status === "ready" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-2"
            >
              <p className="text-muted-foreground">{message}</p>
              {loadedCount > 0 && (
                <div className="flex items-center justify-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 p-3 rounded-lg">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">
                    {loadedCount} questões prontas para o simulado
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {/* Error message */}
          {status === "error" && error && (
            <div className="w-full p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 w-full">
            {status === "preparing" && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                Cancelar
              </Button>
            )}

            {status === "ready" && (
              <Button onClick={onContinue} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Iniciar Simulado
              </Button>
            )}

            {status === "error" && (
              <>
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button onClick={onRetry} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Loading tips */}
        {status === "preparing" && (
          <div className="text-xs text-center text-muted-foreground border-t pt-4 space-y-1">
            <p>💡 <strong>Por que demora?</strong></p>
            <p>
              A API do ENEM tem limite de 1 requisição por segundo. 
              Estamos carregando todas as questões para garantir um simulado completo.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
