import { useCallback, useRef } from "react";
import { isSoundEnabled } from "./useSoundPreferences";

/**
 * Hook para gerenciar efeitos sonoros do aplicativo
 * Usa a Web Audio API para gerar sons simples sem necessidade de arquivos externos
 */
export const useSoundEffects = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Inicializa o AudioContext (lazy)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextConstructor = window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return null;
      audioContextRef.current = new AudioContextConstructor();
    }
    return audioContextRef.current;
  }, []);

  /**
   * Toca um som de sucesso (acerto de questão)
   * Som agudo e curto, similar a "ding!"
   */
  const playCorrectSound = useCallback(() => {
    if (!isSoundEnabled()) return;
    
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Som de sucesso: duas notas ascendentes
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch (error) {
      console.log("[Sound] Erro ao tocar som de acerto:", error);
    }
  }, [getAudioContext]);

  /**
   * Toca um som de erro (erro de questão)
   * Som grave e curto
   */
  const playIncorrectSound = useCallback(() => {
    if (!isSoundEnabled()) return;
    
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Som de erro: nota grave descendente
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(311.13, ctx.currentTime); // Eb4
      oscillator.frequency.setValueAtTime(233.08, ctx.currentTime + 0.15); // Bb3

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.log("[Sound] Erro ao tocar som de erro:", error);
    }
  }, [getAudioContext]);

  /**
   * Toca um som de sucesso/conquista (geração de cronograma, etc)
   * Som mais elaborado, tipo fanfarra curta
   */
  const playSuccessSound = useCallback(() => {
    if (!isSoundEnabled()) return;
    
    try {
      const ctx = getAudioContext();

      // Cria múltiplos osciladores para um som mais rico
      const playNote = (frequency: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startTime);

        gainNode.gain.setValueAtTime(0.2, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      // Fanfarra curta: C-E-G-C (acorde de Dó maior ascendente)
      const now = ctx.currentTime;
      playNote(523.25, now, 0.15);        // C5
      playNote(659.25, now + 0.1, 0.15);  // E5
      playNote(783.99, now + 0.2, 0.15);  // G5
      playNote(1046.50, now + 0.3, 0.3);  // C6
    } catch (error) {
      console.log("[Sound] Erro ao tocar som de sucesso:", error);
    }
  }, [getAudioContext]);

  /**
   * Toca um som de clique/seleção
   * Som muito curto e sutil
   */
  const playClickSound = useCallback(() => {
    if (!isSoundEnabled()) return;
    
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1000, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.05);
    } catch (error) {
      console.log("[Sound] Erro ao tocar som de clique:", error);
    }
  }, [getAudioContext]);

  /**
   * Toca um som de conquista de streak
   * Som celebratório mais longo e festivo
   */
  const playStreakSound = useCallback(() => {
    if (!isSoundEnabled()) return;
    
    try {
      const ctx = getAudioContext();

      const playNote = (frequency: number, startTime: number, duration: number, gain: number = 0.2) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startTime);

        gainNode.gain.setValueAtTime(gain, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      // Som festivo: melodia ascendente com acorde final
      const now = ctx.currentTime;
      playNote(392.00, now, 0.12);          // G4
      playNote(440.00, now + 0.1, 0.12);    // A4
      playNote(493.88, now + 0.2, 0.12);    // B4
      playNote(523.25, now + 0.3, 0.12);    // C5
      playNote(659.25, now + 0.4, 0.12);    // E5
      playNote(783.99, now + 0.5, 0.25);    // G5
      // Acorde final
      playNote(523.25, now + 0.6, 0.4, 0.15);  // C5
      playNote(659.25, now + 0.6, 0.4, 0.15);  // E5
      playNote(783.99, now + 0.6, 0.4, 0.15);  // G5
      playNote(1046.50, now + 0.6, 0.5, 0.2);  // C6
    } catch (error) {
      console.log("[Sound] Erro ao tocar som de streak:", error);
    }
  }, [getAudioContext]);

  return {
    playCorrectSound,
    playIncorrectSound,
    playSuccessSound,
    playClickSound,
    playStreakSound,
  };
};
