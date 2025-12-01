/**
 * Utilitários para formatação de dados da aplicação
 */

/**
 * Formata nomes de disciplinas do ENEM para exibição amigável
 * Ex: "ciencias-humanas" -> "Ciências Humanas"
 */
export const formatDisciplineName = (discipline: string): string => {
  const disciplineMap: Record<string, string> = {
    'linguagens': 'Linguagens',
    'ciencias-humanas': 'Ciências Humanas',
    'humanas': 'Ciências Humanas',
    'ciencias-natureza': 'Ciências da Natureza',
    'natureza': 'Ciências da Natureza',
    'matematica': 'Matemática',
    'ciencias-da-natureza': 'Ciências da Natureza',
  };

  return disciplineMap[discipline.toLowerCase()] || discipline;
};

/**
 * Remove marcadores markdown (**) de texto que não podem ser processados
 * Usado para limpar texto de questões que vêm com markdown não processado
 */
export const cleanMarkdownArtifacts = (text: string): string => {
  if (!text) return '';
  
  // Remove ** que não conseguimos processar como negrito
  return text.replace(/\*\*/g, '');
};

/**
 * Processa texto com markdown simples para negrito
 * Converte **texto** em <strong>texto</strong>
 */
export const processSimpleMarkdown = (text: string): string => {
  if (!text) return '';
  
  // Processa negrito **texto** -> <strong>texto</strong>
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
};
