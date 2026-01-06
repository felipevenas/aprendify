import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "sound_preferences";

interface SoundPreferences {
  enabled: boolean;
}

const defaultPreferences: SoundPreferences = {
  enabled: true,
};

/**
 * Hook para gerenciar preferências de som do usuário
 * Persiste as preferências no localStorage
 */
export const useSoundPreferences = () => {
  const [preferences, setPreferences] = useState<SoundPreferences>(() => {
    if (typeof window === "undefined") return defaultPreferences;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  });

  // Sincroniza com localStorage quando muda
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Erro ao salvar preferências de som:", error);
    }
  }, [preferences]);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setPreferences((prev) => ({ ...prev, enabled }));
  }, []);

  return {
    soundEnabled: preferences.enabled,
    setSoundEnabled,
  };
};

/**
 * Função utilitária para verificar se o som está habilitado
 * Pode ser usada fora de componentes React
 */
export const isSoundEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const preferences = JSON.parse(stored);
      return preferences.enabled ?? true;
    }
    return true;
  } catch {
    return true;
  }
};
