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
 * Identifica e formata referências bibliográficas no texto
 * Retorna objeto com texto principal e referência separados
 */
export const separateTextAndReference = (text: string): { mainText: string; reference: string | null } => {
  if (!text) return { mainText: '', reference: null };
  
  let cleaned = cleanMarkdownArtifacts(text);
  
  // Padrões de referência bibliográfica ENEM
  // Padrão 1: AUTOR, X. et al. Título. Local: Editora, ano (adaptado).
  // Padrão 2: Disponível em: ... Acesso em: ... (adaptado).
  // Padrão 3: SOBRENOME, Nome. Título. Local: Editora, ano.
  
  const referencePatterns = [
    // Disponível em: URL. Acesso em: data (adaptado).
    /(Disponível em:\s*[^\s]+\s*\.?\s*Acesso em:\s*[^.]+\.?\s*\(adaptado\)\.?)/gi,
    // AUTOR et al. Título. Local: Editora, ano (adaptado).
    /([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ][A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ\s,\.]+(?:et al\.?|[A-Z]\.|[A-Z][a-záàâãéèêíïóôõöúüç]+)[\s\S]{0,20}(?:In:|[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ][a-záàâãéèêíïóôõöúüç]+:)?[\s\S]{5,150}?(?:19|20)\d{2}[^.]*\.?\s*\(adaptado\)\.?)/g,
    // AUTOR. Título: subtítulo. ano (adaptado).
    /([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ][A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ\s,\.]{2,50}\.\s+[A-Z][^.]{10,100}\.?\s+(?:19|20)\d{2}[^.]*\(adaptado\)\.?)/g,
    // Disponível em: ... (adaptado)
    /(Disponível em:\s*[^.]+\.\s*\(adaptado\)\.?)/gi,
  ];
  
  let reference: string | null = null;
  let mainText = cleaned;
  
  for (const pattern of referencePatterns) {
    const match = cleaned.match(pattern);
    if (match && match[0]) {
      // Pega a última ocorrência como referência (geralmente a fonte está no final ou meio)
      const lastMatch = match[match.length - 1];
      if (lastMatch.length > 20 && lastMatch.length < cleaned.length * 0.7) {
        reference = lastMatch.trim();
        mainText = cleaned.replace(lastMatch, ' ').replace(/\s+/g, ' ').trim();
        break;
      }
    }
  }
  
  return { mainText, reference };
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
