import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { toast } from "sonner";

export type PomodoroMode = "focus" | "shortBreak" | "longBreak";

export interface PomodoroContextValue {
  timeLeft: number;
  totalTime: number;
  timerActive: boolean;
  pomodoroMode: PomodoroMode;
  toggleTimer: () => void;
  resetTimer: () => void;
  changePomodoroMode: (mode: PomodoroMode) => void;
  formatTime: (seconds: number) => string;
  isExpanded: boolean;
  setIsExpanded: (val: boolean) => void;
}

const PomodoroContext = createContext<PomodoroContextValue | undefined>(undefined);

const MODE_TIMES = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

export const PomodoroProvider = ({ children }: { children: ReactNode }) => {
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>("focus");
  const [timeLeft, setTimeLeft] = useState<number>(MODE_TIMES.focus);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Inicialização e leitura do localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("pomodoro_mode") as PomodoroMode;
    const savedActive = localStorage.getItem("pomodoro_active") === "true";
    const savedTargetEnd = localStorage.getItem("pomodoro_target_end");

    if (savedMode && MODE_TIMES[savedMode]) {
      setPomodoroMode(savedMode);
      
      if (savedActive && savedTargetEnd) {
        const targetTime = parseInt(savedTargetEnd, 10);
        const now = Date.now();
        
        if (targetTime > now) {
          const remaining = Math.round((targetTime - now) / 1000);
          setTimeLeft(remaining);
          setTimerActive(true);
        } else {
          // O tempo expirou enquanto o usuário estava fora
          setTimeLeft(MODE_TIMES[savedMode]);
          setTimerActive(false);
          localStorage.removeItem("pomodoro_active");
          localStorage.removeItem("pomodoro_target_end");
        }
      } else {
        const savedTimeLeft = localStorage.getItem("pomodoro_time_left");
        if (savedTimeLeft) {
          setTimeLeft(parseInt(savedTimeLeft, 10));
        } else {
          setTimeLeft(MODE_TIMES[savedMode]);
        }
      }
    }
  }, []);

  // Monitora alterações de estado para atualizar localStorage
  useEffect(() => {
    localStorage.setItem("pomodoro_mode", pomodoroMode);
    localStorage.setItem("pomodoro_time_left", timeLeft.toString());
    localStorage.setItem("pomodoro_active", timerActive.toString());

    if (timerActive) {
      // Se não houver target_end já definido (por ex: recém iniciado), define
      const currentTarget = localStorage.getItem("pomodoro_target_end");
      if (!currentTarget) {
        const targetEnd = Date.now() + timeLeft * 1000;
        localStorage.setItem("pomodoro_target_end", targetEnd.toString());
      }
    } else {
      localStorage.removeItem("pomodoro_target_end");
    }
  }, [pomodoroMode, timeLeft, timerActive]);

  const playAlertSound = () => {
    try {
      const AudioContextConstructor = window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      const audioCtx = new AudioContextConstructor();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Tom A5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3); // Bipe de 300ms
    } catch (e) {
      console.warn("AudioContext não suportado no navegador", e);
    }
  };

  const handleTimerComplete = () => {
    setTimerActive(false);
    playAlertSound();
    localStorage.removeItem("pomodoro_active");
    localStorage.removeItem("pomodoro_target_end");

    if (pomodoroMode === "focus") {
      toast.success("Parabéns! Sessão de Foco concluída. Hora de descansar!", {
        duration: 5000,
      });
      setPomodoroMode("shortBreak");
      setTimeLeft(MODE_TIMES.shortBreak);
    } else {
      toast.success("Descanso finalizado. Vamos voltar aos estudos?", {
        duration: 5000,
      });
      setPomodoroMode("focus");
      setTimeLeft(MODE_TIMES.focus);
    }
  };

  // Efeito principal do relógio
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, pomodoroMode]);

  const toggleTimer = () => {
    if (!timerActive) {
      // Ao iniciar o timer, registra o target_end no localStorage
      const targetEnd = Date.now() + timeLeft * 1000;
      localStorage.setItem("pomodoro_target_end", targetEnd.toString());
      setTimerActive(true);
    } else {
      // Ao pausar, remove o target_end do localStorage
      localStorage.removeItem("pomodoro_target_end");
      setTimerActive(false);
    }
  };

  const resetTimer = () => {
    setTimerActive(false);
    localStorage.removeItem("pomodoro_active");
    localStorage.removeItem("pomodoro_target_end");
    setTimeLeft(MODE_TIMES[pomodoroMode]);
  };

  const changePomodoroMode = (mode: PomodoroMode) => {
    setTimerActive(false);
    localStorage.removeItem("pomodoro_active");
    localStorage.removeItem("pomodoro_target_end");
    setPomodoroMode(mode);
    setTimeLeft(MODE_TIMES[mode]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const totalTime = MODE_TIMES[pomodoroMode];

  return (
    <PomodoroContext.Provider
      value={{
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
      }}
    >
      {children}
    </PomodoroContext.Provider>
  );
};

export const usePomodoro = (): PomodoroContextValue => {
  const context = useContext(PomodoroContext);
  if (!context) {
    throw new Error("usePomodoro must be used within a PomodoroProvider");
  }
  return context;
};
