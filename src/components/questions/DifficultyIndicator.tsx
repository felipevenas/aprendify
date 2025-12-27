import { cn } from "@/lib/utils";

/**
 * Indicador visual de dificuldade da questão
 * Exibe 3 bolinhas minimalistas que representam o nível de dificuldade
 * - 1 bolinha preenchida = Fácil
 * - 2 bolinhas preenchidas = Médio  
 * - 3 bolinhas preenchidas = Difícil
 */

type DifficultyLevel = "easy" | "medium" | "hard" | null;

interface DifficultyIndicatorProps {
  difficulty: DifficultyLevel;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

// Mapeia dificuldade para configurações visuais
const difficultyConfig = {
  easy: {
    filled: 1,
    label: "Fácil",
    color: "bg-green-500",
    textColor: "text-green-600",
  },
  medium: {
    filled: 2,
    label: "Médio",
    color: "bg-yellow-500",
    textColor: "text-yellow-600",
  },
  hard: {
    filled: 3,
    label: "Difícil",
    color: "bg-red-500",
    textColor: "text-red-600",
  },
};

const DifficultyIndicator = ({ 
  difficulty, 
  showLabel = true, 
  size = "sm",
  className 
}: DifficultyIndicatorProps) => {
  // Se não tiver dificuldade definida, não renderiza nada
  if (!difficulty) return null;

  const config = difficultyConfig[difficulty];
  const dotSize = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Container das 3 bolinhas */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className={cn(
              dotSize,
              "rounded-full transition-colors",
              index <= config.filled
                ? config.color // Bolinha preenchida
                : "bg-muted-foreground/20" // Bolinha vazia
            )}
          />
        ))}
      </div>
      
      {/* Label opcional */}
      {showLabel && (
        <span className={cn(
          "text-xs font-medium",
          config.textColor
        )}>
          {config.label}
        </span>
      )}
    </div>
  );
};

export default DifficultyIndicator;