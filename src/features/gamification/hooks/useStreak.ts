/**
 * Hook para gerenciar o sistema de streak diário
 * 
 * O streak funciona assim:
 * - Usuário precisa responder 5 questões por dia para manter a sequência
 * - Se passar 24h sem completar as 5 questões, o streak é resetado
 * - O streak é incrementado quando o usuário completa 5 questões em um novo dia
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSoundEffects } from '@/hooks/useSoundEffects';

// Constantes do sistema de streak
const REQUIRED_DAILY_QUESTIONS = 5;

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  questionsToday: number;
  streakCompletedToday: boolean;
  lastActivityDate: string | null;
}

interface UseStreakReturn {
  streakData: StreakData | null;
  loading: boolean;
  recordQuestionAnswered: () => Promise<void>;
  checkAndUpdateStreak: () => Promise<void>;
}

export const useStreak = (): UseStreakReturn => {
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const { playStreakSound } = useSoundEffects();

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
        return;
      }

      // Busca ou cria registro de streak
      const streakResponse = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();
      let { data } = streakResponse;
      const { error } = streakResponse;

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

      const today = getTodayDate();
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
            last_activity_date: null, // Será atualizado quando responder questão
          })
          .eq('user_id', user.id);
        
        await fetchStreakData();
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

      await fetchStreakData();
    } catch (error) {
      console.error('Erro ao verificar streak:', error);
    }
  }, [fetchStreakData]);

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
        await fetchStreakData();
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
        
        await fetchStreakData();
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
        
        // Toca som de celebração
        playStreakSound();
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

      await fetchStreakData();
    } catch (error) {
      console.error('Erro ao registrar questão respondida:', error);
    }
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
  }, [loading]);

  return {
    streakData,
    loading,
    recordQuestionAnswered,
    checkAndUpdateStreak,
  };
};

export default useStreak;
