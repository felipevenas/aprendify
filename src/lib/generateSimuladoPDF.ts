import jsPDF from "jspdf";
import { formatDisciplineName, cleanMarkdownArtifacts, separateTextAndReference } from "@/lib/formatters";

interface Alternative {
  letter: string;
  text: string;
  files?: string[] | null;
}

interface QuestionData {
  index: number;
  title: string;
  context: string | null;
  alternatives: Alternative[];
  alternatives_introduction?: string | null;
  discipline: string;
  year: string;
  correct_alternative?: string;
  files?: string[] | null;
}

// ============= CONSTANTS =============
const PAGE = {
  WIDTH: 210,
  HEIGHT: 297,
  MARGIN_TOP: 22,
  MARGIN_BOTTOM: 18,
  MARGIN_LEFT: 20,
  MARGIN_RIGHT: 20,
} as const;

// Paleta monocromática elegante
const COLORS = {
  BLACK: [30, 30, 30] as [number, number, number],
  DARK_GRAY: [60, 60, 60] as [number, number, number],
  GRAY: [100, 100, 100] as [number, number, number],
  LIGHT_GRAY: [140, 140, 140] as [number, number, number],
  CONTEXT_BG: [248, 248, 248] as [number, number, number],
  BORDER: [200, 200, 200] as [number, number, number],
  WHITE: [255, 255, 255] as [number, number, number],
} as const;

const FONTS = {
  HEADER_TITLE: 14,
  HEADER_SUBTITLE: 9,
  QUESTION_NUMBER: 11,
  QUESTION_META: 8,
  QUESTION_TEXT: 10,
  CONTEXT: 9.5,
  REFERENCE: 8,
  ALTERNATIVE: 10,
  CAPTION: 8,
  FOOTER: 7.5,
} as const;

const SPACING = {
  LINE_HEIGHT: 5,
  PARAGRAPH: 7,
  SECTION: 10,
  QUESTION_GAP: 14,
  ALTERNATIVE_GAP: 4,
  CONTEXT_PADDING: 4,
} as const;

// ============= TEXT PROCESSING =============

const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '...')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&bull;/g, '•')
    .replace(/&middot;/g, '·')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&deg;/g, '°')
    .replace(/&plusmn;/g, '±')
    .replace(/&times;/g, '×')
    .replace(/&divide;/g, '÷')
    .replace(/&frac12;/g, '½')
    .replace(/&frac14;/g, '¼')
    .replace(/&frac34;/g, '¾')
    .replace(/&sup2;/g, '²')
    .replace(/&sup3;/g, '³')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
};

const cleanTextForPDF = (html: string): string => {
  if (!html) return '';
  
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div>/gi, '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ul>/gi, '')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<ol>/gi, '')
    .replace(/<[^>]+>/g, '');
  
  text = decodeHtmlEntities(text);
  text = cleanMarkdownArtifacts(text);
  
  text = text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter((line, idx, arr) => {
      if (line === '' && idx > 0 && arr[idx - 1] === '') return false;
      return true;
    })
    .join('\n')
    .trim();
  
  return text;
};

interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

const parseFormattedText = (html: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  
  let text = html
    .replace(/<strong>/gi, '[[B]]')
    .replace(/<\/strong>/gi, '[[/B]]')
    .replace(/<b>/gi, '[[B]]')
    .replace(/<\/b>/gi, '[[/B]]')
    .replace(/<em>/gi, '[[I]]')
    .replace(/<\/em>/gi, '[[/I]]')
    .replace(/<i>/gi, '[[I]]')
    .replace(/<\/i>/gi, '[[/I]]');
  
  text = cleanTextForPDF(text);
  
  text = text.replace(/\*\*([^*]+)\*\*/g, '[[B]]$1[[/B]]');
  text = text.replace(/__([^_]+)__/g, '[[B]]$1[[/B]]');
  
  let bold = false;
  let italic = false;
  let buffer = '';
  
  const flush = () => {
    if (buffer) {
      segments.push({ text: buffer, bold, italic });
      buffer = '';
    }
  };
  
  let i = 0;
  while (i < text.length) {
    if (text.substring(i, i + 5) === '[[B]]') {
      flush();
      bold = true;
      i += 5;
    } else if (text.substring(i, i + 6) === '[[/B]]') {
      flush();
      bold = false;
      i += 6;
    } else if (text.substring(i, i + 5) === '[[I]]') {
      flush();
      italic = true;
      i += 5;
    } else if (text.substring(i, i + 6) === '[[/I]]') {
      flush();
      italic = false;
      i += 6;
    } else {
      buffer += text[i];
      i++;
    }
  }
  flush();
  
  if (segments.length === 0) {
    return [{ text: cleanTextForPDF(html), bold: false, italic: false }];
  }
  
  return segments;
};

const loadImageAsBase64 = async (url: string): Promise<{ data: string; width: number; height: number } | null> => {
  try {
    let finalUrl = url;
    
    if (!url.startsWith('http')) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        const cleanPath = url.startsWith('/') ? url.slice(1) : url;
        if (cleanPath.includes('enem-images') || cleanPath.includes('storage')) {
          finalUrl = `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
        } else {
          finalUrl = `${supabaseUrl}/storage/v1/object/public/enem-images/${cleanPath}`;
        }
      } else {
        return null;
      }
    }
    
    const response = await fetch(finalUrl, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) return null;
    
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      const img = new Image();
      
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        img.onload = () => resolve({ data: dataUrl, width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ data: dataUrl, width: 200, height: 150 });
        img.src = dataUrl;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[PDF] Failed to load image:', url, error);
    return null;
  }
};

const getImageFormat = (dataUrl: string): string => {
  if (dataUrl.includes('image/png')) return 'PNG';
  if (dataUrl.includes('image/gif')) return 'GIF';
  return 'JPEG';
};

// ============= PDF GENERATOR =============

export const generateSimuladoPDF = async (
  questions: QuestionData[],
  simuladoType: string,
  simuladoYear?: string | null
): Promise<void> => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const contentWidth = PAGE.WIDTH - PAGE.MARGIN_LEFT - PAGE.MARGIN_RIGHT;
  const maxY = PAGE.HEIGHT - PAGE.MARGIN_BOTTOM;
  
  let currentPage = 1;
  let yPosition = PAGE.MARGIN_TOP;

  const answerKey: { question: number; answer: string; discipline: string }[] = [];

  // ============= PAGE UTILITIES =============
  
  const addHeader = (isAnswerKey = false) => {
    // Título principal
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONTS.HEADER_TITLE);
    doc.setTextColor(...COLORS.BLACK);
    
    let title = isAnswerKey ? "GABARITO" : "SIMULADO ENEM";
    if (simuladoYear) title += ` ${simuladoYear}`;
    doc.text(title, PAGE.MARGIN_LEFT, 14);
    
    // Subtipo do simulado
    const typeLabels: Record<string, string> = {
      official_day1: "Dia 1 – Linguagens e Ciências Humanas",
      official_day2: "Dia 2 – Matemática e Ciências da Natureza",
      custom_naturezas: "Ciências da Natureza",
      custom_humanas: "Ciências Humanas",
      custom_matematica: "Matemática",
      custom_mixed: "Simulado Personalizado"
    };
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.HEADER_SUBTITLE);
    doc.setTextColor(...COLORS.GRAY);
    doc.text(typeLabels[simuladoType] || "Simulado", PAGE.MARGIN_LEFT, 18);
    
    // Informações à direita
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.CAPTION);
    doc.setTextColor(...COLORS.GRAY);
    doc.text(`Página ${currentPage}`, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 14, { align: "right" });
    if (!isAnswerKey) {
      doc.text(`${questions.length} questões`, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 18, { align: "right" });
    }
    
    // Linha separadora
    doc.setDrawColor(...COLORS.BORDER);
    doc.setLineWidth(0.4);
    doc.line(PAGE.MARGIN_LEFT, 21, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 21);
  };

  const addFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.FOOTER);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.text("Aprendify – Simulado ENEM", PAGE.WIDTH / 2, PAGE.HEIGHT - 10, { align: "center" });
  };

  const checkPageBreak = (requiredHeight: number): boolean => {
    if (yPosition + requiredHeight > maxY) {
      doc.addPage();
      currentPage++;
      addHeader();
      yPosition = PAGE.MARGIN_TOP + 6;
      return true;
    }
    return false;
  };

  // Desenha texto simples com quebra de linha automática
  const drawSimpleText = (
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    fontSize: number,
    color: [number, number, number],
    fontStyle: "normal" | "bold" | "italic" = "normal",
    lineSpacing: number = SPACING.LINE_HEIGHT
  ): number => {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    
    const cleanText = cleanTextForPDF(text);
    const lines = doc.splitTextToSize(cleanText, maxWidth);
    
    let y = startY;
    for (const line of lines) {
      if (y + lineSpacing > maxY) {
        doc.addPage();
        currentPage++;
        addHeader();
        y = PAGE.MARGIN_TOP + 6;
      }
      doc.text(line, x, y);
      y += lineSpacing;
    }
    
    return y - startY;
  };

  // Desenha texto formatado (negrito/itálico) com quebra de linha
  const drawFormattedText = (
    rawText: string,
    x: number,
    startY: number,
    maxWidth: number,
    fontSize: number,
    color: [number, number, number],
    lineSpacing: number = SPACING.LINE_HEIGHT
  ): number => {
    const segments = parseFormattedText(rawText);
    doc.setFontSize(fontSize);
    
    interface LineWord { text: string; bold: boolean; italic: boolean; }
    const lines: LineWord[][] = [];
    let currentLine: LineWord[] = [];
    let currentLineWidth = 0;
    
    for (const segment of segments) {
      const words = segment.text.split(/(\s+)/);
      
      for (const word of words) {
        if (!word) continue;
        
        // Quebra de linha explícita
        if (word.includes('\n')) {
          const subParts = word.split('\n');
          subParts.forEach((subPart, idx) => {
            if (subPart) {
              const style = segment.bold ? 'bold' : segment.italic ? 'italic' : 'normal';
              doc.setFont("helvetica", style);
              const partWidth = doc.getTextWidth(subPart);
              
              if (currentLineWidth + partWidth > maxWidth && currentLine.length > 0) {
                lines.push([...currentLine]);
                currentLine = [];
                currentLineWidth = 0;
              }
              currentLine.push({ text: subPart, bold: segment.bold, italic: segment.italic });
              currentLineWidth += partWidth;
            }
            if (idx < subParts.length - 1) {
              if (currentLine.length > 0) {
                lines.push([...currentLine]);
                currentLine = [];
                currentLineWidth = 0;
              }
            }
          });
          continue;
        }
        
        const style = segment.bold ? 'bold' : segment.italic ? 'italic' : 'normal';
        doc.setFont("helvetica", style);
        const partWidth = doc.getTextWidth(word);
        
        if (currentLineWidth + partWidth > maxWidth && currentLine.length > 0) {
          lines.push([...currentLine]);
          currentLine = [];
          currentLineWidth = 0;
        }
        currentLine.push({ text: word, bold: segment.bold, italic: segment.italic });
        currentLineWidth += partWidth;
      }
    }
    if (currentLine.length > 0) lines.push(currentLine);
    
    let y = startY;
    for (const line of lines) {
      if (y + lineSpacing > maxY) {
        doc.addPage();
        currentPage++;
        addHeader();
        y = PAGE.MARGIN_TOP + 6;
      }
      
      let currentX = x;
      for (const word of line) {
        const style = word.bold ? 'bold' : word.italic ? 'italic' : 'normal';
        doc.setFont("helvetica", style);
        doc.setTextColor(...color);
        doc.text(word.text, currentX, y);
        currentX += doc.getTextWidth(word.text);
      }
      y += lineSpacing;
    }
    
    return y - startY;
  };

  // Desenha imagem centralizada
  const drawImage = (
    imageData: { data: string; width: number; height: number },
    x: number,
    startY: number,
    maxWidth: number,
    maxHeight: number = 55
  ): number => {
    try {
      const aspectRatio = imageData.height / imageData.width;
      let imgWidth = Math.min(maxWidth * 0.9, imageData.width * 0.264583);
      let imgHeight = imgWidth * aspectRatio;
      
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight / aspectRatio;
      }
      
      const totalHeight = imgHeight + 6;
      
      if (startY + totalHeight > maxY) {
        doc.addPage();
        currentPage++;
        addHeader();
        startY = PAGE.MARGIN_TOP + 6;
      }
      
      // Centralizar imagem
      const imgX = x + (maxWidth - imgWidth) / 2;
      
      const format = getImageFormat(imageData.data);
      doc.addImage(imageData.data, format, imgX, startY, imgWidth, imgHeight);
      
      return totalHeight;
    } catch (error) {
      console.warn('[PDF] Image draw failed:', error);
      return 0;
    }
  };

  // ============= PRE-LOAD IMAGES =============
  
  console.log('[PDF] Pre-loading images...');
  const imageCache: Map<string, { data: string; width: number; height: number }> = new Map();
  
  for (const question of questions) {
    if (question.files && question.files.length > 0) {
      for (const file of question.files) {
        if (!imageCache.has(file)) {
          const img = await loadImageAsBase64(file);
          if (img) imageCache.set(file, img);
        }
      }
    }
    for (const alt of question.alternatives) {
      if (alt.files && alt.files.length > 0) {
        for (const file of alt.files) {
          if (!imageCache.has(file)) {
            const img = await loadImageAsBase64(file);
            if (img) imageCache.set(file, img);
          }
        }
      }
    }
  }
  console.log(`[PDF] Loaded ${imageCache.size} images`);

  // ============= GENERATE QUESTIONS =============
  
  addHeader();
  yPosition = PAGE.MARGIN_TOP + 6;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionNumber = i + 1;

    if (question.correct_alternative) {
      answerKey.push({
        question: questionNumber,
        answer: question.correct_alternative.toUpperCase(),
        discipline: question.discipline,
      });
    }

    // Verificar espaço mínimo para iniciar questão
    checkPageBreak(30);

    // ===== QUESTION HEADER =====
    
    // Número da questão - destaque
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONTS.QUESTION_NUMBER);
    doc.setTextColor(...COLORS.BLACK);
    doc.text(`QUESTÃO ${String(questionNumber).padStart(2, '0')}`, PAGE.MARGIN_LEFT, yPosition);
    
    // Metadados - disciplina e ano
    const disciplineName = formatDisciplineName(question.discipline);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.QUESTION_META);
    doc.setTextColor(...COLORS.GRAY);
    const metaText = `${disciplineName} • ENEM ${question.year}`;
    doc.text(metaText, PAGE.WIDTH - PAGE.MARGIN_RIGHT, yPosition, { align: "right" });
    
    yPosition += 8;

    // ===== TEXTO DE APOIO / CONTEXTO =====
    
    if (question.context && question.context.trim()) {
      const processed = separateTextAndReference(question.context);
      const contextText = cleanTextForPDF(processed.mainText);
      
      if (contextText) {
        // Calcular altura do contexto
        doc.setFontSize(FONTS.CONTEXT);
        const contextLines = doc.splitTextToSize(contextText, contentWidth - 10);
        const estimatedHeight = contextLines.length * SPACING.LINE_HEIGHT + SPACING.CONTEXT_PADDING * 2;
        
        checkPageBreak(Math.min(estimatedHeight, 60));
        
        // Fundo sutil para o contexto (opcional - caixa de texto de apoio)
        doc.setFillColor(...COLORS.CONTEXT_BG);
        doc.setDrawColor(...COLORS.BORDER);
        doc.setLineWidth(0.2);
        
        // Desenhar caixa de contexto
        const boxStartY = yPosition;
        
        // Barra lateral indicadora
        doc.setFillColor(...COLORS.GRAY);
        doc.rect(PAGE.MARGIN_LEFT, boxStartY, 1.5, estimatedHeight, 'F');
        
        // Conteúdo do contexto
        const contextHeight = drawFormattedText(
          processed.mainText,
          PAGE.MARGIN_LEFT + 6,
          yPosition + SPACING.CONTEXT_PADDING,
          contentWidth - 10,
          FONTS.CONTEXT,
          COLORS.DARK_GRAY,
          SPACING.LINE_HEIGHT
        );
        
        yPosition += contextHeight + SPACING.CONTEXT_PADDING + SPACING.PARAGRAPH;
        
        // Referência bibliográfica (se existir)
        if (processed.reference) {
          checkPageBreak(12);
          
          // Referência em itálico, menor e alinhada à direita
          doc.setFont("helvetica", "italic");
          doc.setFontSize(FONTS.REFERENCE);
          doc.setTextColor(...COLORS.GRAY);
          
          const refLines = doc.splitTextToSize(processed.reference, contentWidth - 10);
          refLines.forEach((line: string) => {
            doc.text(line, PAGE.WIDTH - PAGE.MARGIN_RIGHT - 4, yPosition, { align: "right" });
            yPosition += 4;
          });
          yPosition += 3;
        }
      }
    }

    // ===== IMAGENS DA QUESTÃO =====
    
    if (question.files && question.files.length > 0) {
      for (const file of question.files) {
        const img = imageCache.get(file);
        if (img) {
          const imgHeight = drawImage(img, PAGE.MARGIN_LEFT, yPosition, contentWidth, 60);
          yPosition += imgHeight + SPACING.PARAGRAPH;
        }
      }
    }

    // ===== ENUNCIADO DA QUESTÃO (TÍTULO) =====
    
    checkPageBreak(20);
    
    const statementHeight = drawFormattedText(
      question.title,
      PAGE.MARGIN_LEFT,
      yPosition,
      contentWidth,
      FONTS.QUESTION_TEXT,
      COLORS.BLACK,
      SPACING.LINE_HEIGHT
    );
    
    yPosition += statementHeight + SPACING.PARAGRAPH;

    // ===== INTRODUÇÃO DAS ALTERNATIVAS =====
    
    if (question.alternatives_introduction && question.alternatives_introduction.trim()) {
      checkPageBreak(12);
      
      const introHeight = drawFormattedText(
        question.alternatives_introduction,
        PAGE.MARGIN_LEFT,
        yPosition,
        contentWidth,
        FONTS.QUESTION_TEXT,
        COLORS.BLACK,
        SPACING.LINE_HEIGHT
      );
      
      yPosition += introHeight + SPACING.PARAGRAPH;
    }

    // ===== ALTERNATIVAS =====
    
    for (const alt of question.alternatives) {
      checkPageBreak(15);
      
      // Letra da alternativa - em negrito
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONTS.ALTERNATIVE);
      doc.setTextColor(...COLORS.BLACK);
      const letterLabel = `(${alt.letter.toUpperCase()})`;
      doc.text(letterLabel, PAGE.MARGIN_LEFT, yPosition);
      
      // Texto da alternativa
      const altTextX = PAGE.MARGIN_LEFT + 12;
      const altTextWidth = contentWidth - 14;
      
      const altTextHeight = drawFormattedText(
        alt.text,
        altTextX,
        yPosition,
        altTextWidth,
        FONTS.ALTERNATIVE,
        COLORS.BLACK,
        SPACING.LINE_HEIGHT
      );
      
      yPosition += Math.max(altTextHeight, SPACING.LINE_HEIGHT);
      
      // Imagens da alternativa (se houver)
      if (alt.files && alt.files.length > 0) {
        for (const file of alt.files) {
          const img = imageCache.get(file);
          if (img) {
            yPosition += 2;
            const imgHeight = drawImage(img, altTextX, yPosition, altTextWidth, 45);
            yPosition += imgHeight;
          }
        }
      }
      
      yPosition += SPACING.ALTERNATIVE_GAP;
    }
    
    // ===== SEPARADOR ENTRE QUESTÕES =====
    
    if (i < questions.length - 1) {
      yPosition += 6;
      
      // Linha separadora sutil
      doc.setDrawColor(...COLORS.BORDER);
      doc.setLineWidth(0.3);
      doc.line(PAGE.MARGIN_LEFT + 20, yPosition, PAGE.WIDTH - PAGE.MARGIN_RIGHT - 20, yPosition);
      
      yPosition += SPACING.QUESTION_GAP;
    }
  }

  // ============= PÁGINA DO GABARITO =============
  
  doc.addPage();
  currentPage++;
  addHeader(true);
  yPosition = PAGE.MARGIN_TOP + 10;

  // Título do gabarito
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.BLACK);
  doc.text("GABARITO OFICIAL", PAGE.WIDTH / 2, yPosition, { align: "center" });
  yPosition += 7;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONTS.CAPTION);
  doc.setTextColor(...COLORS.GRAY);
  doc.text(
    `${questions.length} questões • Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    PAGE.WIDTH / 2, yPosition, { align: "center" }
  );
  yPosition += 12;

  // Tabela de gabarito - 5 colunas
  const gridCols = 5;
  const cellWidth = contentWidth / gridCols;
  const cellHeight = 9;
  
  // Cabeçalho da tabela
  doc.setFillColor(...COLORS.CONTEXT_BG);
  doc.setDrawColor(...COLORS.BORDER);
  doc.setLineWidth(0.3);
  doc.rect(PAGE.MARGIN_LEFT, yPosition, contentWidth, 7, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONTS.CAPTION);
  doc.setTextColor(...COLORS.DARK_GRAY);
  
  for (let col = 0; col < gridCols; col++) {
    const colX = PAGE.MARGIN_LEFT + col * cellWidth + cellWidth / 2;
    doc.text("Nº – Resp.", colX, yPosition + 5, { align: "center" });
    if (col > 0) {
      doc.line(PAGE.MARGIN_LEFT + col * cellWidth, yPosition, PAGE.MARGIN_LEFT + col * cellWidth, yPosition + 7);
    }
  }
  yPosition += 7;

  // Linhas do gabarito
  const rows = Math.ceil(answerKey.length / gridCols);
  
  for (let row = 0; row < rows; row++) {
    checkPageBreak(cellHeight);
    
    // Borda da linha
    doc.setDrawColor(...COLORS.BORDER);
    doc.setLineWidth(0.2);
    doc.rect(PAGE.MARGIN_LEFT, yPosition, contentWidth, cellHeight, "S");
    
    for (let col = 0; col < gridCols; col++) {
      const idx = row * gridCols + col;
      if (idx >= answerKey.length) break;
      
      const item = answerKey[idx];
      const colX = PAGE.MARGIN_LEFT + col * cellWidth;
      
      // Separador de coluna
      if (col > 0) {
        doc.line(colX, yPosition, colX, yPosition + cellHeight);
      }
      
      // Formato: "01 – A"
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.BLACK);
      doc.text(
        `${String(item.question).padStart(2, '0')} – ${item.answer}`,
        colX + cellWidth / 2,
        yPosition + 6,
        { align: "center" }
      );
    }
    
    yPosition += cellHeight;
  }

  // Resumo por área
  yPosition += 14;
  checkPageBreak(35);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.BLACK);
  doc.text("Resumo por Área de Conhecimento", PAGE.MARGIN_LEFT, yPosition);
  yPosition += 8;
  
  const disciplineCounts: Record<string, number> = {};
  answerKey.forEach(item => {
    const disc = formatDisciplineName(item.discipline);
    disciplineCounts[disc] = (disciplineCounts[disc] || 0) + 1;
  });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.DARK_GRAY);
  
  Object.entries(disciplineCounts).forEach(([disc, count]) => {
    doc.text(`• ${disc}: ${count} ${count === 1 ? 'questão' : 'questões'}`, PAGE.MARGIN_LEFT + 6, yPosition);
    yPosition += 6;
  });

  // Adicionar rodapé em todas as páginas
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter();
  }

  // Salvar arquivo
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `simulado-enem${simuladoYear ? `-${simuladoYear}` : ""}-${timestamp}.pdf`;
  console.log(`[PDF] Saving: ${filename}`);
  doc.save(filename);
};
