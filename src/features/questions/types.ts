export interface QuestionAlternative {
  letter: string;
  text: string;
  files?: string[];
  file?: string;
}

export interface StudyQuestion {
  id?: string;
  index: number;
  title: string;
  discipline: string;
  language?: string | null;
  context?: string | null;
  files?: string[] | null;
  images?: string[] | null;
  alternativesIntroduction?: string | null;
  alternatives: QuestionAlternative[];
  correctAlternative: string;
  correct_alternative?: string;
  year: string;
  difficulty?: "easy" | "medium" | "hard" | null;
  mainTopic?: string | null;
  subtopics?: string[] | null;
  topic?: string | null;
}
