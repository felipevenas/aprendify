/**
 * StreakContext - Contexto global para gerenciar o sistema de streak
 * 
 * Este contexto permite que o estado do streak seja compartilhado entre
 * todos os componentes da aplicação, evitando múltiplas instâncias
 * e garantindo atualização em tempo real.
 * 
 * Features:
 * - Estado global compartilhado
 * - Realtime updates via Supabase
 * - Auto-refresh quando dados mudam
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Constantes do sistema de streak
const REQUIRED_DAILY_QUESTIONS = 5;

// Tipos para o contexto de streak
interface StreakData {
  currentStreak: number;
  longestStreak: number;
  questionsToday: number;
  streakCompletedToday: boolean;
  lastActivityDate: string | null;
}

interface StreakContextType {
  streakData: StreakData | null;
  loading: boolean;
  recordQuestionAnswered: () => Promise<void>;
  checkAndUpdateStreak: () => Promise<void>;
  refreshStreak: () => Promise<void>;
}

// Contexto com valores padrão
const StreakContext = createContext<StreakContextType | undefined>(undefined);

/**
 * Hook para usar o contexto de streak
 * Deve ser usado dentro do StreakProvider
 */
export const useStreakContext = (): StreakContextType => {
  const context = useContext(StreakContext);
  if (!context) {
    throw new Error('useStreakContext deve ser usado dentro de um StreakProvider');
  }
  return context;
};

interface StreakProviderProps {
  children: ReactNode;
}

/**
 * Provider do contexto de streak
 * Gerencia todo o estado e lógica do sistema de streak
 */
export const StreakProvider: React.FC<StreakProviderProps> = ({ children }) => {
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  /**
   * Obtém a data atual no formato YYYY-MM-DD (timezone local)
   */
  const getTodayDate = (): string => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  /**
   * Verifica se a última atividade foi ontem
   */
  const wasYesterday = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const lastDate = new Date(dateStr + 'T00:00:00');
    const today = new Date(getTodayDate() + 'T00:00:00');
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays === 1;
  };

  /**
   * Verifica se a última atividade foi hoje
   */
  const wasToday = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    return dateStr === getTodayDate();
  };

  /**
   * Busca os dados de streak do usuário
   */
  const fetchStreakData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setUserId(null);
        return;
      }

      setUserId(user.id);

      // Busca ou cria registro de streak
      let { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Registro não existe, cria um novo
        const { data: newData, error: insertError } = await supabase
          .from('user_streaks')
          .insert({ user_id: user.id })
          .select()
          .single();

        if (insertError) throw insertError;
        data = newData;
      } else if (error) {
        throw error;
      }

      if (data) {
        setStreakData({
          currentStreak: data.current_streak,
          longestStreak: data.longest_streak,
          questionsToday: data.questions_today,
          streakCompletedToday: data.streak_completed_today,
          lastActivityDate: data.last_activity_date,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar dados de streak:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Verifica e atualiza o streak baseado na última atividade
   * Reseta o streak se passou mais de 24h sem completar as 5 questões
   */
  const checkAndUpdateStreak = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error || !data) return;

      const lastActivity = data.last_activity_date;

      // Se a última atividade foi hoje, não precisa fazer nada
      if (wasToday(lastActivity)) {
        return;
      }

      // Se a última atividade foi ontem e completou o streak, mantém
      if (wasYesterday(lastActivity) && data.streak_completed_today) {
        // Reseta contagem diária para o novo dia
        await supabase
          .from('user_streaks')
          .update({
            questions_today: 0,
            streak_completed_today: false,
            last_activity_date: null,
          })
          .eq('user_id', user.id);
        
        return;
      }

      // Se passou mais de um dia ou não completou ontem, reseta o streak
      if (data.current_streak > 0) {
        const hadStreak = data.current_streak > 0;
        
        await supabase
          .from('user_streaks')
          .update({
            current_streak: 0,
            questions_today: 0,
            streak_completed_today: false,
            last_activity_date: null,
          })
          .eq('user_id', user.id);

        if (hadStreak) {
          toast.error('Sequência perdida!', {
            description: `Você perdeu sua sequência de ${data.current_streak} dia(s). Responda 5 questões hoje para começar uma nova!`,
            duration: 5000,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao verificar streak:', error);
    }
  }, []);

  /**
   * Registra uma questão respondida e atualiza o streak se necessário
   */
  const recordQuestionAnswered = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = getTodayDate();

      // Busca dados atuais
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Cria registro se não existir
        await supabase
          .from('user_streaks')
          .insert({
            user_id: user.id,
            questions_today: 1,
            last_activity_date: today,
          });
        return;
      }

      if (error || !data) return;

      // Se já completou hoje, apenas incrementa contador
      if (data.streak_completed_today && wasToday(data.last_activity_date)) {
        await supabase
          .from('user_streaks')
          .update({
            questions_today: data.questions_today + 1,
          })
          .eq('user_id', user.id);
        
        return;
      }

      // Calcula novas questões do dia
      let newQuestionsToday = 1;
      if (wasToday(data.last_activity_date)) {
        newQuestionsToday = data.questions_today + 1;
      }

      // Verifica se atingiu as 5 questões diárias
      const willCompleteStreak = newQuestionsToday >= REQUIRED_DAILY_QUESTIONS;

      // Calcula novo streak
      let newStreak = data.current_streak;
      if (willCompleteStreak && !data.streak_completed_today) {
        // Se ontem completou o streak, incrementa; senão, começa do 1
        if (wasYesterday(data.last_activity_date) || wasToday(data.last_activity_date)) {
          newStreak = data.current_streak + 1;
        } else if (data.current_streak === 0) {
          newStreak = 1;
        } else {
          // Streak foi quebrado, começa novo
          newStreak = 1;
        }

        toast.success('🔥 Streak do dia completo!', {
          description: `Você está em uma sequência de ${newStreak} dia(s)! Continue assim!`,
          duration: 4000,
        });
      }

      // Atualiza maior streak se necessário
      const newLongestStreak = Math.max(data.longest_streak, newStreak);

      await supabase
        .from('user_streaks')
        .update({
          questions_today: newQuestionsToday,
          last_activity_date: today,
          streak_completed_today: willCompleteStreak,
          current_streak: newStreak,
          longest_streak: newLongestStreak,
        })
        .eq('user_id', user.id);

    } catch (error) {
      console.error('Erro ao registrar questão respondida:', error);
    }
  }, []);

  /**
   * Função para forçar refresh dos dados
   */
  const refreshStreak = useCallback(async () => {
    await fetchStreakData();
  }, [fetchStreakData]);

  // Carrega dados iniciais e verifica streak
  useEffect(() => {
    fetchStreakData();
  }, [fetchStreakData]);

  // Verifica streak quando o componente monta
  useEffect(() => {
    if (!loading && streakData) {
      checkAndUpdateStreak();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Configura listener de realtime para atualizações do streak
  useEffect(() => {
    if (!userId) return;

    // Cria canal de realtime para escutar mudanças na tabela user_streaks
    const channel = supabase
      .channel(`user_streaks_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'user_streaks',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[StreakContext] Realtime update received:', payload);
          
          // Atualiza o estado local com os novos dados
          if (payload.new && typeof payload.new === 'object') {
            const newData = payload.new as {
              current_streak: number;
              longest_streak: number;
              questions_today: number;
              streak_completed_today: boolean;
              last_activity_date: string | null;
            };
            
            setStreakData({
              currentStreak: newData.current_streak,
              longestStreak: newData.longest_streak,
              questionsToday: newData.questions_today,
              streakCompletedToday: newData.streak_completed_today,
              lastActivityDate: newData.last_activity_date,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[StreakContext] Realtime subscription status:', status);
      });

    // Cleanup ao desmontar
    return () => {
      console.log('[StreakContext] Removing realtime channel');
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Escuta mudanças de autenticação
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        fetchStreakData();
      } else if (event === 'SIGNED_OUT') {
        setStreakData(null);
        setUserId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchStreakData]);

  const value: StreakContextType = {
    streakData,
    loading,
    recordQuestionAnswered,
    checkAndUpdateStreak,
    refreshStreak,
  };

  return (
    <StreakContext.Provider value={value}>
      {children}
    </StreakContext.Provider>
  );
};

export default StreakContext;
