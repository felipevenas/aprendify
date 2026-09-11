/**
 * Componente que exibe o indicador de streak (ícone de fogo)
 * 
 * O ícone fica mais "forte" (cores mais intensas) conforme o streak aumenta:
 * - 0 dias: cinza apagado
 * - 1-2 dias: laranja fraco
 * - 3-6 dias: laranja médio
 * - 7-13 dias: laranja forte
 * - 14-29 dias: vermelho
 * - 30+ dias: vermelho intenso com animação
 */

import React from 'react';
import { Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface StreakIndicatorProps {
  currentStreak: number;
  questionsToday: number;
  streakCompletedToday: boolean;
  longestStreak: number;
}

// Constante para meta diária
const DAILY_GOAL = 5;

export const StreakIndicator: React.FC<StreakIndicatorProps> = ({
  currentStreak,
  questionsToday,
  streakCompletedToday,
  longestStreak,
}) => {
  /**
   * Retorna as classes de estilo baseado no nível do streak
   */
  const getStreakStyles = (): { colorClass: string; glowClass: string; animate: boolean } => {
    if (currentStreak === 0) {
      return {
        colorClass: 'text-muted-foreground/50',
        glowClass: '',
        animate: false,
      };
    }
    if (currentStreak <= 2) {
      return {
        colorClass: 'text-orange-400',
        glowClass: '',
        animate: false,
      };
    }
    if (currentStreak <= 6) {
      return {
        colorClass: 'text-orange-500',
        glowClass: 'drop-shadow-[0_0_4px_rgba(249,115,22,0.4)]',
        animate: false,
      };
    }
    if (currentStreak <= 13) {
      return {
        colorClass: 'text-orange-600',
        glowClass: 'drop-shadow-[0_0_6px_rgba(234,88,12,0.5)]',
        animate: true,
      };
    }
    if (currentStreak <= 29) {
      return {
        colorClass: 'text-red-500',
        glowClass: 'drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]',
        animate: true,
      };
    }
    // 30+ dias
    return {
      colorClass: 'text-red-600',
      glowClass: 'drop-shadow-[0_0_12px_rgba(220,38,38,0.8)]',
      animate: true,
    };
  };

  const { colorClass, glowClass, animate } = getStreakStyles();
  const progress = Math.min(questionsToday / DAILY_GOAL, 1);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className="relative flex items-center gap-1 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Ícone de fogo com animação */}
            <motion.div
              animate={animate ? {
                scale: [1, 1.1, 1],
                rotate: [0, -5, 5, 0],
              } : undefined}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
            >
              <Flame
                className={cn(
                  'h-5 w-5 transition-all duration-300',
                  colorClass,
                  glowClass
                )}
              />
            </motion.div>

            {/* Contador de streak */}
            <span className={cn(
              'text-sm font-semibold tabular-nums',
              currentStreak > 0 ? colorClass : 'text-muted-foreground'
            )}>
              {currentStreak}
            </span>

            {/* Indicador de progresso diário (anel ao redor do fogo) */}
            {!streakCompletedToday && currentStreak >= 0 && (
              <svg
                className="absolute -inset-1 h-7 w-7"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted/30"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${progress * 62.83} 62.83`}
                  strokeLinecap="round"
                  className={cn(
                    'transition-all duration-300',
                    progress > 0 ? 'text-orange-500' : 'text-transparent'
                  )}
                  transform="rotate(-90 12 12)"
                />
              </svg>
            )}

            {/* Check quando completou o dia */}
            {streakCompletedToday && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full flex items-center justify-center"
              >
                <span className="text-[8px] text-white">✓</span>
              </motion.div>
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1 text-sm">
            <p className="font-semibold">
              🔥 Sequência: {currentStreak} dia{currentStreak !== 1 ? 's' : ''}
            </p>
            <p className="text-muted-foreground">
              Questões hoje: {questionsToday}/{DAILY_GOAL}
              {streakCompletedToday && ' ✅'}
            </p>
            {longestStreak > 0 && (
              <p className="text-muted-foreground">
                Maior sequência: {longestStreak} dia{longestStreak !== 1 ? 's' : ''}
              </p>
            )}
            {!streakCompletedToday && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                Responda {DAILY_GOAL - questionsToday} questão(ões) para manter sua sequência!
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default StreakIndicator;
