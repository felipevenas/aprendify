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
 * Remove marcadores markdown e corrige problemas comuns de codificação
 * Usado para limpar texto de questões que vêm com formatação incorreta
 */
export const cleanMarkdownArtifacts = (text: string): string => {
  if (!text) return '';
  
  let cleaned = text;
  
  // Remove ** que não conseguimos processar como negrito
  cleaned = cleaned.replace(/\*\*/g, '');
  
  // Remove HTML entities comuns
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#39;/g, "'");
  
  // Remove espaços duplicados
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
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
