/**
 * Hook de preloader desativado (no-op)
 * 
 * As questões agora são consultadas em tempo real de forma otimizada diretamente no Supabase.
 * Esta rotina de preloading assíncrona do IndexedDB foi desativada para otimizar 
 * o tráfego de dados e poupar bateria/CPU em dispositivos móveis.
 */
export function useBackgroundPreloader() {
  return {
    isPreloading: false,
    preloadProgress: 100
  };
}

/**
 * Retorna o status de preloader (sempre concluído)
 */
export function getPreloadStatus() {
  return {
    isPreloading: false,
    progress: 100
  };
}
