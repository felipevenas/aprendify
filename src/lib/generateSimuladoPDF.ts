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
  MARGIN_TOP: 20,
  MARGIN_BOTTOM: 15,
  MARGIN_LEFT: 18,
  MARGIN_RIGHT: 18,
} as const;

// Paleta monocromática - preto, cinza escuro, cinza claro
const COLORS = {
  BLACK: [17, 24, 39] as [number, number, number],
  DARK_GRAY: [75, 85, 99] as [number, number, number],
  GRAY: [107, 114, 128] as [number, number, number],
  LIGHT_GRAY: [156, 163, 175] as [number, number, number],
  BORDER: [209, 213, 219] as [number, number, number],
  WHITE: [255, 255, 255] as [number, number, number],
} as const;

const FONTS = {
  HEADER_TITLE: 13,
  HEADER_SUBTITLE: 9,
  QUESTION_NUMBER: 10,
  QUESTION_TEXT: 9.5,
  CONTEXT: 9,
  ALTERNATIVE: 9,
  CAPTION: 7.5,
  FOOTER: 7,
} as const;

const SPACING = {
  LINE_HEIGHT: 4.5,
  PARAGRAPH: 6,
  SECTION: 8,
  QUESTION_GAP: 12,
  ALTERNATIVE_GAP: 3,
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
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
};

const cleanTextForPDF = (html: string): string => {
  if (!html) return '';
  
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  
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
    // Título simples em preto
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONTS.HEADER_TITLE);
    doc.setTextColor(...COLORS.BLACK);
    
    let title = isAnswerKey ? "GABARITO" : "SIMULADO ENEM";
    if (simuladoYear) title += ` ${simuladoYear}`;
    doc.text(title, PAGE.MARGIN_LEFT, 12);
    
    // Subtipo em cinza
    const typeLabels: Record<string, string> = {
      official_day1: "Dia 1 - Linguagens e Ciências Humanas",
      official_day2: "Dia 2 - Matemática e Ciências da Natureza",
      custom_naturezas: "Ciências da Natureza",
      custom_humanas: "Ciências Humanas",
      custom_matematica: "Matemática",
      custom_mixed: "Simulado Personalizado"
    };
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.HEADER_SUBTITLE);
    doc.setTextColor(...COLORS.GRAY);
    doc.text(typeLabels[simuladoType] || "Simulado", PAGE.MARGIN_LEFT, 16);
    
    // Página à direita
    doc.text(`Página ${currentPage}`, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 12, { align: "right" });
    if (!isAnswerKey) {
      doc.text(`${questions.length} questões`, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 16, { align: "right" });
    }
    
    // Linha separadora simples
    doc.setDrawColor(...COLORS.BORDER);
    doc.setLineWidth(0.3);
    doc.line(PAGE.MARGIN_LEFT, 18, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 18);
  };

  const addFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.FOOTER);
    doc.setTextColor(...COLORS.LIGHT_GRAY);
    doc.text("Aprendify - Simulado ENEM", PAGE.WIDTH / 2, PAGE.HEIGHT - 8, { align: "center" });
  };

  const checkPageBreak = (requiredHeight: number): boolean => {
    if (yPosition + requiredHeight > maxY) {
      doc.addPage();
      currentPage++;
      addHeader();
      yPosition = PAGE.MARGIN_TOP + 4;
      return true;
    }
    return false;
  };

  const drawText = (
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
        y = PAGE.MARGIN_TOP + 4;
      }
      doc.text(line, x, y);
      y += lineSpacing;
    }
    
    return y - startY;
  };

  const drawFormattedText = (
    rawText: string,
    x: number,
    startY: number,
    maxWidth: number,
    fontSize: number,
    color: [number, number, number]
  ): number => {
    const segments = parseFormattedText(rawText);
    doc.setFontSize(fontSize);
    
    interface LineWord { text: string; bold: boolean; italic: boolean; }
    const lines: LineWord[][] = [];
    let currentLine: LineWord[] = [];
    let currentLineWidth = 0;
    
    for (const segment of segments) {
      const parts = segment.text.split(/(\s+)/);
      
      for (const part of parts) {
        if (!part) continue;
        
        if (part.includes('\n')) {
          const subParts = part.split('\n');
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
        const partWidth = doc.getTextWidth(part);
        
        if (currentLineWidth + partWidth > maxWidth && currentLine.length > 0) {
          lines.push([...currentLine]);
          currentLine = [];
          currentLineWidth = 0;
        }
        currentLine.push({ text: part, bold: segment.bold, italic: segment.italic });
        currentLineWidth += partWidth;
      }
    }
    if (currentLine.length > 0) lines.push(currentLine);
    
    let y = startY;
    for (const line of lines) {
      if (y + SPACING.LINE_HEIGHT > maxY) {
        doc.addPage();
        currentPage++;
        addHeader();
        y = PAGE.MARGIN_TOP + 4;
      }
      
      let currentX = x;
      for (const word of line) {
        const style = word.bold ? 'bold' : word.italic ? 'italic' : 'normal';
        doc.setFont("helvetica", style);
        doc.setTextColor(...color);
        doc.text(word.text, currentX, y);
        currentX += doc.getTextWidth(word.text);
      }
      y += SPACING.LINE_HEIGHT;
    }
    
    return y - startY;
  };

  const drawImage = (
    imageData: { data: string; width: number; height: number },
    x: number,
    startY: number,
    maxWidth: number,
    maxHeight: number = 60
  ): number => {
    try {
      const aspectRatio = imageData.height / imageData.width;
      let imgWidth = Math.min(maxWidth, imageData.width * 0.264583);
      let imgHeight = imgWidth * aspectRatio;
      
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight / aspectRatio;
      }
      
      if (startY + imgHeight + 4 > maxY) {
        doc.addPage();
        currentPage++;
        addHeader();
        startY = PAGE.MARGIN_TOP + 4;
      }
      
      // Centralizar imagem sem bordas
      const imgX = x + (maxWidth - imgWidth) / 2;
      
      const format = getImageFormat(imageData.data);
      doc.addImage(imageData.data, format, imgX, startY, imgWidth, imgHeight);
      
      return imgHeight + 4;
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
  yPosition = PAGE.MARGIN_TOP + 4;

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

    checkPageBreak(25);

    // ===== QUESTION HEADER - Simples =====
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONTS.QUESTION_NUMBER);
    doc.setTextColor(...COLORS.BLACK);
    doc.text(`Questão ${String(questionNumber).padStart(2, '0')}`, PAGE.MARGIN_LEFT, yPosition);
    
    // Disciplina e ano em cinza
    const disciplineName = formatDisciplineName(question.discipline);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.CAPTION);
    doc.setTextColor(...COLORS.GRAY);
    doc.text(`${disciplineName} • ENEM ${question.year}`, PAGE.MARGIN_LEFT + 28, yPosition);
    
    yPosition += 8;

    // ===== CONTEXT (Texto de Apoio) - Indentado com linha vertical =====
    
    if (question.context && question.context.trim()) {
      const processed = separateTextAndReference(question.context);
      
      doc.setFontSize(FONTS.CONTEXT);
      const contextLines = doc.splitTextToSize(cleanTextForPDF(processed.mainText), contentWidth - 8);
      const contextHeight = contextLines.length * SPACING.LINE_HEIGHT + 4;
      
      checkPageBreak(Math.min(contextHeight, 50));
      
      // Linha vertical cinza claro como indicador
      doc.setDrawColor(...COLORS.LIGHT_GRAY);
      doc.setLineWidth(0.5);
      doc.line(PAGE.MARGIN_LEFT, yPosition, PAGE.MARGIN_LEFT, yPosition + contextHeight);
      
      // Texto do contexto com indentação
      const contextTextHeight = drawFormattedText(
        processed.mainText,
        PAGE.MARGIN_LEFT + 5,
        yPosition + 2,
        contentWidth - 8,
        FONTS.CONTEXT,
        COLORS.DARK_GRAY
      );
      
      yPosition += Math.max(contextTextHeight + 4, contextHeight) + SPACING.PARAGRAPH;
      
      // Referência (se existir)
      if (processed.reference) {
        checkPageBreak(8);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(FONTS.CAPTION);
        doc.setTextColor(...COLORS.GRAY);
        const refLines = doc.splitTextToSize(processed.reference, contentWidth - 6);
        refLines.forEach((line: string) => {
          doc.text(line, PAGE.MARGIN_LEFT + 5, yPosition);
          yPosition += 3.5;
        });
        yPosition += 2;
      }
    }

    // ===== QUESTION IMAGES =====
    
    if (question.files && question.files.length > 0) {
      for (const file of question.files) {
        const img = imageCache.get(file);
        if (img) {
          const imgHeight = drawImage(img, PAGE.MARGIN_LEFT, yPosition, contentWidth, 55);
          yPosition += imgHeight + SPACING.PARAGRAPH;
        }
      }
    }

    // ===== QUESTION STATEMENT (Enunciado) =====
    
    checkPageBreak(15);
    
    const statementHeight = drawFormattedText(
      question.title,
      PAGE.MARGIN_LEFT,
      yPosition,
      contentWidth,
      FONTS.QUESTION_TEXT,
      COLORS.BLACK
    );
    
    yPosition += statementHeight + SPACING.PARAGRAPH;

    // ===== ALTERNATIVES INTRODUCTION =====
    
    if (question.alternatives_introduction && question.alternatives_introduction.trim()) {
      checkPageBreak(10);
      
      const introHeight = drawFormattedText(
        question.alternatives_introduction,
        PAGE.MARGIN_LEFT,
        yPosition,
        contentWidth,
        FONTS.QUESTION_TEXT,
        COLORS.BLACK
      );
      
      yPosition += introHeight + SPACING.PARAGRAPH;
    }

    // ===== ALTERNATIVES - Formato (A) simples =====
    
    for (const alt of question.alternatives) {
      checkPageBreak(12);
      
      // Letra entre parênteses
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONTS.ALTERNATIVE);
      doc.setTextColor(...COLORS.BLACK);
      doc.text(`(${alt.letter.toUpperCase()})`, PAGE.MARGIN_LEFT, yPosition);
      
      // Texto da alternativa
      const altTextHeight = drawFormattedText(
        alt.text,
        PAGE.MARGIN_LEFT + 10,
        yPosition,
        contentWidth - 12,
        FONTS.ALTERNATIVE,
        COLORS.BLACK
      );
      
      yPosition += Math.max(altTextHeight, SPACING.LINE_HEIGHT);
      
      // Imagens das alternativas
      if (alt.files && alt.files.length > 0) {
        for (const file of alt.files) {
          const img = imageCache.get(file);
          if (img) {
            const imgHeight = drawImage(img, PAGE.MARGIN_LEFT + 10, yPosition, contentWidth - 16, 40);
            yPosition += imgHeight;
          }
        }
      }
      
      yPosition += SPACING.ALTERNATIVE_GAP;
    }
    
    // Separador de questão - linha sólida simples
    if (i < questions.length - 1) {
      yPosition += 4;
      doc.setDrawColor(...COLORS.BORDER);
      doc.setLineWidth(0.2);
      doc.line(PAGE.MARGIN_LEFT, yPosition, PAGE.WIDTH - PAGE.MARGIN_RIGHT, yPosition);
      yPosition += SPACING.QUESTION_GAP;
    }
  }

  // ============= ANSWER KEY - Tabela simples =============
  
  doc.addPage();
  currentPage++;
  addHeader(true);
  yPosition = PAGE.MARGIN_TOP + 8;

  // Título simples
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.BLACK);
  doc.text("GABARITO", PAGE.WIDTH / 2, yPosition, { align: "center" });
  yPosition += 6;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONTS.CAPTION);
  doc.setTextColor(...COLORS.GRAY);
  doc.text(
    `${questions.length} questões • ${new Date().toLocaleDateString('pt-BR')}`,
    PAGE.WIDTH / 2, yPosition, { align: "center" }
  );
  yPosition += 10;

  // Tabela de gabarito - 5 colunas
  const gridCols = 5;
  const cellWidth = contentWidth / gridCols;
  const cellHeight = 8;
  
  // Header da tabela
  doc.setDrawColor(...COLORS.BORDER);
  doc.setLineWidth(0.3);
  doc.rect(PAGE.MARGIN_LEFT, yPosition, contentWidth, 6, "S");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONTS.CAPTION);
  doc.setTextColor(...COLORS.BLACK);
  
  for (let col = 0; col < gridCols; col++) {
    const colX = PAGE.MARGIN_LEFT + col * cellWidth + cellWidth / 2;
    doc.text("Nº - R", colX, yPosition + 4, { align: "center" });
    if (col > 0) {
      doc.line(PAGE.MARGIN_LEFT + col * cellWidth, yPosition, PAGE.MARGIN_LEFT + col * cellWidth, yPosition + 6);
    }
  }
  yPosition += 6;

  // Linhas de respostas
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
      
      // Formato: "01 - A"
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.BLACK);
      doc.text(
        `${String(item.question).padStart(2, '0')} - ${item.answer}`,
        colX + cellWidth / 2,
        yPosition + 5.5,
        { align: "center" }
      );
    }
    
    yPosition += cellHeight;
  }

  // Resumo por área - lista simples
  yPosition += 12;
  checkPageBreak(30);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.BLACK);
  doc.text("Resumo por Área", PAGE.MARGIN_LEFT, yPosition);
  yPosition += 7;
  
  const disciplineCounts: Record<string, number> = {};
  answerKey.forEach(item => {
    const disc = formatDisciplineName(item.discipline);
    disciplineCounts[disc] = (disciplineCounts[disc] || 0) + 1;
  });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.DARK_GRAY);
  
  Object.entries(disciplineCounts).forEach(([disc, count]) => {
    doc.text(`• ${disc}: ${count} questões`, PAGE.MARGIN_LEFT + 4, yPosition);
    yPosition += 5;
  });

  // Rodapés em todas as páginas
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter();
  }

  // Salvar
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `simulado-enem${simuladoYear ? `-${simuladoYear}` : ""}-${timestamp}.pdf`;
  console.log(`[PDF] Saving: ${filename}`);
  doc.save(filename);
};
