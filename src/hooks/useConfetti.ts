import { useCallback } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiOptions {
  type?: 'streak' | 'achievement' | 'correct' | 'celebration';
}

/**
 * Hook para disparar efeitos de confetti em momentos de celebração
 */
export const useConfetti = () => {
  /**
   * Dispara confetti baseado no tipo de celebração
   */
  const fireConfetti = useCallback(({ type = 'celebration' }: ConfettiOptions = {}) => {
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    switch (type) {
      case 'streak':
        // Confetti em formato de fogo para streaks
        confetti({
          ...defaults,
          particleCount: 100,
          spread: 70,
          colors: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'],
          shapes: ['circle'],
          scalar: 1.2,
        });
        break;

      case 'achievement': {
        // Confetti dourado para conquistas
        const duration = 3000;
        const animationEnd = Date.now() + duration;

        const frame = () => {
          confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.7 },
            colors: ['#fbbf24', '#f59e0b', '#d97706', '#ffffff'],
            zIndex: 9999,
          });
          confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.7 },
            colors: ['#fbbf24', '#f59e0b', '#d97706', '#ffffff'],
            zIndex: 9999,
          });

          if (Date.now() < animationEnd) {
            requestAnimationFrame(frame);
          }
        };
        frame();
        break;
      }

      case 'correct':
        // Confetti sutil para resposta correta
        confetti({
          ...defaults,
          particleCount: 50,
          spread: 60,
          colors: ['#22c55e', '#16a34a', '#86efac', '#ffffff'],
          shapes: ['circle'],
          scalar: 0.8,
        });
        break;

      case 'celebration':
      default: {
        // Confetti padrão de celebração
        const count = 200;
        const defaultColors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

        function fire(particleRatio: number, opts: confetti.Options) {
          confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio),
            colors: defaultColors,
          });
        }

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
        break;
      }
    }
  }, []);

  /**
   * Dispara confetti para streak completado
   */
  const fireStreakConfetti = useCallback(() => {
    fireConfetti({ type: 'streak' });
  }, [fireConfetti]);

  /**
   * Dispara confetti para conquista desbloqueada
   */
  const fireAchievementConfetti = useCallback(() => {
    fireConfetti({ type: 'achievement' });
  }, [fireConfetti]);

  /**
   * Dispara confetti sutil para resposta correta
   */
  const fireCorrectConfetti = useCallback(() => {
    fireConfetti({ type: 'correct' });
  }, [fireConfetti]);

  return {
    fireConfetti,
    fireStreakConfetti,
    fireAchievementConfetti,
    fireCorrectConfetti,
  };
};

export default useConfetti;
