/**
 * Matérias fixas do sistema para questões do ENEM
 * Estas disciplinas são usadas em todo o sistema como base para anotações,
 * cronogramas e análise de desempenho
 */

export interface FixedSubject {
  id: string; // Identificador único (slug)
  name: string; // Nome para exibição
  color: string; // Cor associada (HSL)
}

/**
 * Lista de matérias fixas do ENEM
 * Cada matéria possui um id único, nome amigável e cor para identificação visual
 */
export const FIXED_SUBJECTS: FixedSubject[] = [
  { 
    id: "linguagens", 
    name: "Linguagens", 
    color: "#3B82F6" // Blue
  },
  { 
    id: "ciencias-humanas", 
    name: "Ciências Humanas", 
    color: "#8B5CF6" // Purple
  },
  { 
    id: "ciencias-natureza", 
    name: "Ciências da Natureza", 
    color: "#22C55E" // Green
  },
  { 
    id: "matematica", 
    name: "Matemática", 
    color: "#F97316" // Orange
  },
  { 
    id: "redacao", 
    name: "Redação", 
    color: "#EF4444" // Red
  },
];

/**
 * Busca uma matéria fixa pelo id
 * @param id - Identificador da matéria (ex: "linguagens", "matematica")
 * @returns A matéria encontrada ou undefined
 */
export const getSubjectById = (id: string): FixedSubject | undefined => {
  return FIXED_SUBJECTS.find(s => s.id === id);
};

/**
 * Busca uma matéria fixa pelo nome da disciplina do ENEM
 * Faz matching flexível com termos parciais
 * @param discipline - Nome da disciplina vindo da questão (ex: "ciencias-humanas", "humanas")
 * @returns A matéria encontrada ou undefined
 */
export const getSubjectByDiscipline = (discipline: string): FixedSubject | undefined => {
  const normalized = discipline.toLowerCase().trim();
  
  // Mapeamento de termos alternativos para matérias
  const disciplineMap: Record<string, string> = {
    'linguagens': 'linguagens',
    'humanas': 'ciencias-humanas',
    'ciencias-humanas': 'ciencias-humanas',
    'natureza': 'ciencias-natureza',
    'ciencias-natureza': 'ciencias-natureza',
    'ciencias-da-natureza': 'ciencias-natureza',
    'matematica': 'matematica',
    'redacao': 'redacao',
  };
  
  const mappedId = disciplineMap[normalized] || normalized;
  return FIXED_SUBJECTS.find(s => s.id === mappedId);
};

/**
 * Retorna a cor de uma disciplina para uso em badges e indicadores visuais
 * @param discipline - Nome da disciplina
 * @returns Cor em formato hex ou cor padrão
 */
export const getSubjectColor = (discipline: string): string => {
  const subject = getSubjectByDiscipline(discipline);
  return subject?.color || "#6B7280"; // Gray como fallback
};
