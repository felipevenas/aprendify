export interface EssayCriterion {
  score: number;
  maxScore: number;
  feedback: string;
}

export interface EssayCorrection {
  generalFeedback: string;
  strengths: string[];
  improvements: string[];
  criteria: Record<string, EssayCriterion>;
}

export interface Essay {
  id: string;
  user_id: string;
  title: string;
  content: string;
  feedback: string | null;
  score_competency_1: number | null;
  score_competency_2: number | null;
  score_competency_3: number | null;
  score_competency_4: number | null;
  score_competency_5: number | null;
  score_total: number | null;
  status: string;
  tips: string | null;
  created_at: string;
  updated_at: string;
}
