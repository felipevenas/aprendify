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
  theme: string;
  content: string;
  total_score: number | null;
  status: "draft" | "submitted" | "correcting" | "corrected" | "error";
  correction_data: EssayCorrection | null;
  word_count: number | null;
  created_at: string;
  updated_at?: string;
}
