/**
 * Cálculo simplificado de nota TRI (Teoria de Resposta ao Item)
 * 
 * O ENEM usa TRI para calcular notas de forma mais justa:
 * - Acertar questões difíceis vale mais
 * - Errar questões fáceis penaliza mais
 * - Inconsistências (acertar difíceis e errar fáceis) são penalizadas
 * 
 * Esta é uma aproximação simplificada, não a fórmula oficial do INEP.
 */

export interface QuestionResult {
  difficulty: 'easy' | 'medium' | 'hard';
  isCorrect: boolean;
  discipline?: string;
}

export interface TRIScore {
  /** Nota TRI estimada (0-1000) */
  score: number;
  /** Nota bruta (porcentagem de acertos) */
  rawScore: number;
  /** Fator de consistência (0-1, maior = mais consistente) */
  consistencyFactor: number;
  /** Detalhamento por dificuldade */
  breakdown: {
    easy: { correct: number; total: number; weight: number };
    medium: { correct: number; total: number; weight: number };
    hard: { correct: number; total: number; weight: number };
  };
}

// Pesos por dificuldade (questões difíceis valem mais)
const DIFFICULTY_WEIGHTS = {
  easy: 0.7,
  medium: 1.0,
  hard: 1.4,
};

// Penalidade por inconsistência (errar fácil e acertar difícil)
const INCONSISTENCY_PENALTY = 0.85;

// Limites históricos reais aproximados da escala ENEM por área de conhecimento
export const AREA_TRI_BOUNDS = {
  matematica: { min: 320, max: 985, label: "Matemática e suas Tecnologias" },
  linguagens: { min: 310, max: 825, label: "Linguagens, Códigos e suas Tecnologias" },
  humanas: { min: 315, max: 855, label: "Ciências Humanas e suas Tecnologias" },
  natureza: { min: 305, max: 875, label: "Ciências da Natureza e suas Tecnologias" },
  geral: { min: 300, max: 900, label: "Geral" },
} as const;

export type ENEMAreaKey = keyof typeof AREA_TRI_BOUNDS;

/**
 * Estima a nota TRI para uma determinada quantidade de acertos em uma área do ENEM (0 a 45)
 * Utiliza curva sigmoidal ajustada ao histórico real de notas mínimas e máximas do INEP.
 */
export function estimateAreaTRI(
  area: 'matematica' | 'linguagens' | 'humanas' | 'natureza' | string,
  correctCount: number,
  total: number = 45
): number {
  const normArea = (area.toLowerCase().includes('mat') ? 'matematica' :
    area.toLowerCase().includes('ling') ? 'linguagens' :
    area.toLowerCase().includes('hum') ? 'humanas' :
    area.toLowerCase().includes('nat') ? 'natureza' : 'geral') as ENEMAreaKey;

  const bounds = AREA_TRI_BOUNDS[normArea] || AREA_TRI_BOUNDS.geral;
  if (correctCount <= 0) return bounds.min;
  if (correctCount >= total) return bounds.max;

  // Proporção de acertos
  const ratio = Math.min(Math.max(correctCount / total, 0), 1);

  // Curva logística/sigmóide aproximada da TRI do ENEM
  // Para Matemática, o topo da curva cresce mais acentuadamente nos acertos finais
  const exponent = normArea === 'matematica' ? 2.4 : normArea === 'linguagens' ? 1.8 : 2.1;
  const progression = Math.pow(ratio, exponent);

  const estimated = bounds.min + (bounds.max - bounds.min) * (progression * 0.85 + ratio * 0.15);
  return Math.round(estimated);
}

// Limites da escala ENEM padrão (fallback)
const MIN_SCORE = 300;
const MAX_SCORE = 900;
const SCORE_RANGE = MAX_SCORE - MIN_SCORE;

/**
 * Calcula a nota TRI estimada baseada nas respostas
 * 
 * @param results - Array com os resultados de cada questão
 * @returns Objeto com a nota TRI e detalhamentos
 */
export function calculateTRI(results: QuestionResult[]): TRIScore {
  if (results.length === 0) {
    return {
      score: 0,
      rawScore: 0,
      consistencyFactor: 1,
      breakdown: {
        easy: { correct: 0, total: 0, weight: DIFFICULTY_WEIGHTS.easy },
        medium: { correct: 0, total: 0, weight: DIFFICULTY_WEIGHTS.medium },
        hard: { correct: 0, total: 0, weight: DIFFICULTY_WEIGHTS.hard },
      },
    };
  }

  // Agrupa resultados por dificuldade
  const breakdown = {
    easy: { correct: 0, total: 0, weight: DIFFICULTY_WEIGHTS.easy },
    medium: { correct: 0, total: 0, weight: DIFFICULTY_WEIGHTS.medium },
    hard: { correct: 0, total: 0, weight: DIFFICULTY_WEIGHTS.hard },
  };

  results.forEach((result) => {
    const difficulty = result.difficulty || 'medium';
    breakdown[difficulty].total++;
    if (result.isCorrect) {
      breakdown[difficulty].correct++;
    }
  });

  // Calcula taxa de acerto por dificuldade
  const easyRate = breakdown.easy.total > 0 ? breakdown.easy.correct / breakdown.easy.total : 0;
  const mediumRate = breakdown.medium.total > 0 ? breakdown.medium.correct / breakdown.medium.total : 0;
  const hardRate = breakdown.hard.total > 0 ? breakdown.hard.correct / breakdown.hard.total : 0;

  // Detecta inconsistência: errar mais fáceis que difíceis
  let consistencyFactor = 1.0;
  
  // Se acertou mais difíceis do que fáceis (incomum), aplica penalidade
  if (breakdown.easy.total > 0 && breakdown.hard.total > 0) {
    if (hardRate > easyRate + 0.2) {
      // Grande inconsistência
      consistencyFactor = INCONSISTENCY_PENALTY * 0.9;
    } else if (hardRate > easyRate) {
      // Pequena inconsistência
      consistencyFactor = INCONSISTENCY_PENALTY;
    }
  }

  // Calcula score ponderado
  let weightedCorrect = 0;
  let totalWeight = 0;

  Object.entries(breakdown).forEach(([, data]) => {
    if (data.total > 0) {
      weightedCorrect += data.correct * data.weight;
      totalWeight += data.total * data.weight;
    }
  });

  // Score base (0-1)
  const baseScore = totalWeight > 0 ? weightedCorrect / totalWeight : 0;

  // Aplica fator de consistência
  const adjustedScore = baseScore * consistencyFactor;

  // Converte para escala ENEM (300-900)
  const triScore = MIN_SCORE + (adjustedScore * SCORE_RANGE);

  // Calcula score bruto (porcentagem simples)
  const totalCorrect = results.filter(r => r.isCorrect).length;
  const rawScore = (totalCorrect / results.length) * 100;

  return {
    score: Math.round(triScore),
    rawScore: Math.round(rawScore * 10) / 10,
    consistencyFactor: Math.round(consistencyFactor * 100) / 100,
    breakdown,
  };
}

/**
 * Formata a nota TRI para exibição
 */
export function formatTRIScore(score: number): string {
  return score.toFixed(0);
}

/**
 * Retorna a classificação da nota TRI
 */
export function getTRIClassification(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 800) {
    return {
      label: 'Excelente',
      color: 'text-green-500',
      description: 'Desempenho muito acima da média',
    };
  } else if (score >= 700) {
    return {
      label: 'Muito Bom',
      color: 'text-emerald-500',
      description: 'Desempenho acima da média',
    };
  } else if (score >= 600) {
    return {
      label: 'Bom',
      color: 'text-blue-500',
      description: 'Desempenho na média superior',
    };
  } else if (score >= 500) {
    return {
      label: 'Regular',
      color: 'text-amber-500',
      description: 'Desempenho na média',
    };
  } else if (score >= 400) {
    return {
      label: 'Precisa Melhorar',
      color: 'text-orange-500',
      description: 'Desempenho abaixo da média',
    };
  } else {
    return {
      label: 'Crítico',
      color: 'text-red-500',
      description: 'Necessita atenção urgente',
    };
  }
}

/**
 * Calcula notas TRI por disciplina
 */
export function calculateTRIByDiscipline(
  results: QuestionResult[]
): Record<string, TRIScore> {
  const byDiscipline: Record<string, QuestionResult[]> = {};

  results.forEach((result) => {
    const discipline = result.discipline || 'Geral';
    if (!byDiscipline[discipline]) {
      byDiscipline[discipline] = [];
    }
    byDiscipline[discipline].push(result);
  });

  const scores: Record<string, TRIScore> = {};
  Object.entries(byDiscipline).forEach(([discipline, disciplineResults]) => {
    scores[discipline] = calculateTRI(disciplineResults);
  });

  return scores;
}
