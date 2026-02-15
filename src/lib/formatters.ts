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
  
  // Remove markdown de imagens (ex: ![](url)) e URLs soltas de imagens
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  cleaned = cleaned.replace(/https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|svg|webp)(?:\?[^\s]*)?/gi, '');
  
  // Remove HTML entities comuns
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#39;/g, "'");
  
  // Remove apenas espaços horizontais duplicados (preserva quebras de linha!)
  // [^\S\n\r]+ = qualquer whitespace EXCETO \n e \r
  cleaned = cleaned.replace(/[^\S\n\r]+/g, ' ');
  
  // Remove linhas em branco duplicadas (mais de 2 quebras consecutivas)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
};

/**
 * Identifica padrões de referências bibliográficas no texto ENEM
 * Otimizado para evitar regex com backtracking catastrófico
 */
const findReferences = (text: string): string[] => {
  const references: string[] = [];
  
  // Padrão simples: Disponível em: ... Acesso em: ...
  const disponiveisMatch = text.match(/Disponível em:[^.]+\.[^.]*Acesso em:[^.]+\./gi);
  if (disponiveisMatch) {
    references.push(...disponiveisMatch);
  }
  
  // Padrão simples para referências com ano entre parênteses ou com "(adaptado)"
  const adaptadoMatch = text.match(/[^.]+\(\s*adaptado\s*\)\s*\.?/gi);
  if (adaptadoMatch) {
    // Filtra apenas referências que parecem bibliográficas (com ano)
    adaptadoMatch.forEach(match => {
      if (/(?:19|20)\d{2}/.test(match) || /Disponível|Acesso/.test(match)) {
        references.push(match.trim());
      }
    });
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
  
  // Limpa espaços horizontais duplicados (preserva quebras de linha!)
  mainText = mainText.replace(/[^\S\n\r]+/g, ' ');
  
  // Remove linhas em branco duplicadas
  mainText = mainText.replace(/\n{3,}/g, '\n\n');
  
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
