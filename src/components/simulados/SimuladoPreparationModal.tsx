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
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SimuladoPreparationModalProps {
  open: boolean;
  status: "idle" | "preparing" | "ready" | "error";
  progress: number;
  message: string;
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
  onContinue: () => void;
}

/**
 * Modal de preparação do simulado
 * Exibe progresso de carregamento e garante que as questões estejam prontas
 */
export const SimuladoPreparationModal = ({
  open,
  status,
  progress,
  message,
  error,
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
              "Aguarde enquanto carregamos todas as questões para garantir uma experiência completa."}
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

          {/* Progress bar for preparing state */}
          {status === "preparing" && (
            <div className="w-full space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">{message}</p>
            </div>
          )}

          {/* Success message */}
          {status === "ready" && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-muted-foreground"
            >
              {message}
            </motion.p>
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
          <div className="text-xs text-center text-muted-foreground border-t pt-4">
            💡 Dica: Garantimos que todas as questões estejam carregadas para evitar
            interrupções durante o simulado.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
