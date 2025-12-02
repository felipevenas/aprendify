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
  
  // Remove códigos de questão (ex: *020325AZ7*)
  cleaned = cleaned.replace(/\*\d{6}[A-Z]+\d*\*/g, '');
  
  // Remove HTML entities comuns
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#39;/g, "'");
  
  // Remove espaços duplicados e quebras de linha extras
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

/**
 * Identifica padrões de referências bibliográficas no texto ENEM
 */
const findReferences = (text: string): string[] => {
  const references: string[] = [];
  
  // Padrão: Disponível em: URL. Acesso em: data (adaptado).
  const disponiveisMatches = text.match(/Disponível em:\s*[^\s]+[^.]*\.\s*(?:Acesso em:\s*[^.]+\.?)?\s*(?:\(adaptado\))?\.?/gi);
  if (disponiveisMatches) {
    references.push(...disponiveisMatches);
  }
  
  // Padrão: SOBRENOME, N. Título. Local: Editora, ano (adaptado).
  // Captura referências que começam com nome em caps seguido de vírgula e inicial
  const autorMatches = text.match(/[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ][A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÜÇ]+,\s*[A-Z]\.(?:\s*[A-Z]\.)*(?:\s*(?:et al\.?|[A-Za-záàâãéèêíïóôõöúüç\s]+))*[^.]*(?:19|20)\d{2}[^.]*(?:\(adaptado\))?\.?/g);
  if (autorMatches) {
    references.push(...autorMatches);
  }
  
  return references;
};

/**
 * Identifica e formata referências bibliográficas no texto
 * Retorna objeto com texto principal e referências separadas
 */
export const separateTextAndReference = (text: string): { mainText: string; reference: string | null } => {
  if (!text) return { mainText: '', reference: null };
  
  let cleaned = cleanMarkdownArtifacts(text);
  
  // Encontra todas as referências
  const foundReferences = findReferences(cleaned);
  
  if (foundReferences.length === 0) {
    return { mainText: cleaned, reference: null };
  }
  
  // Combina referências encontradas
  let mainText = cleaned;
  const uniqueRefs: string[] = [];
  
  for (const ref of foundReferences) {
    const trimmedRef = ref.trim();
    // Só considera referências que não são muito curtas e não são a maior parte do texto
    if (trimmedRef.length > 30 && trimmedRef.length < cleaned.length * 0.6) {
      if (!uniqueRefs.some(r => r.includes(trimmedRef) || trimmedRef.includes(r))) {
        uniqueRefs.push(trimmedRef);
        mainText = mainText.replace(trimmedRef, ' ');
      }
    }
  }
  
  // Limpa o texto principal
  mainText = mainText.replace(/\s+/g, ' ').trim();
  
  // Remove pontuação solta no início/fim
  mainText = mainText.replace(/^\s*[.,;:]\s*/, '').replace(/\s*[.,;:]\s*$/, '').trim();
  
  const reference = uniqueRefs.length > 0 ? uniqueRefs.join(' | ') : null;
  
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
