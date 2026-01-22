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
  MARGIN_LEFT: 16,
  MARGIN_RIGHT: 16,
} as const;

const COLORS = {
  PRIMARY: [37, 99, 235] as [number, number, number],
  TEXT: [17, 24, 39] as [number, number, number],
  MUTED: [75, 85, 99] as [number, number, number],
  LIGHT: [156, 163, 175] as [number, number, number],
  BORDER: [209, 213, 219] as [number, number, number],
  BACKGROUND: [249, 250, 251] as [number, number, number],
  CONTEXT_BG: [243, 244, 246] as [number, number, number],
  CORRECT: [22, 163, 74] as [number, number, number],
  WHITE: [255, 255, 255] as [number, number, number],
} as const;

const FONTS = {
  HEADER_TITLE: 14,
  HEADER_SUBTITLE: 9,
  QUESTION_NUMBER: 10,
  QUESTION_TEXT: 9.5,
  CONTEXT: 9,
  ALTERNATIVE_INTRO: 9.5,
  ALTERNATIVE: 9,
  CAPTION: 7.5,
  FOOTER: 7,
} as const;

const SPACING = {
  LINE_HEIGHT: 4.2,
  PARAGRAPH: 5,
  SECTION: 8,
  QUESTION_GAP: 10,
  ALTERNATIVE_GAP: 2.5,
} as const;

// ============= TEXT PROCESSING =============

/**
 * Decode HTML entities
 */
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

/**
 * Clean text for PDF - remove HTML and normalize
 */
const cleanTextForPDF = (html: string): string => {
  if (!html) return '';
  
  let text = html
    // Convert line break tags to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    // Remove HTML tags but preserve content
    .replace(/<[^>]+>/g, ' ');
  
  text = decodeHtmlEntities(text);
  
  // Use cleanMarkdownArtifacts for additional cleaning
  text = cleanMarkdownArtifacts(text);
  
  // Normalize whitespace within lines
  text = text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter((line, idx, arr) => {
      // Remove multiple consecutive empty lines
      if (line === '' && idx > 0 && arr[idx - 1] === '') return false;
      return true;
    })
    .join('\n')
    .trim();
  
  return text;
};

/**
 * Text segment with formatting
 */
interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Parse text for bold/italic formatting markers
 */
const parseFormattedText = (html: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  
  // Replace HTML formatting tags with markers
  let text = html
    .replace(/<strong>/gi, '[[B]]')
    .replace(/<\/strong>/gi, '[[/B]]')
    .replace(/<b>/gi, '[[B]]')
    .replace(/<\/b>/gi, '[[/B]]')
    .replace(/<em>/gi, '[[I]]')
    .replace(/<\/em>/gi, '[[/I]]')
    .replace(/<i>/gi, '[[I]]')
    .replace(/<\/i>/gi, '[[/I]]');
  
  // Clean the rest
  text = cleanTextForPDF(text);
  
  // Handle markdown **bold** and *italic*
  text = text.replace(/\*\*([^*]+)\*\*/g, '[[B]]$1[[/B]]');
  text = text.replace(/__([^_]+)__/g, '[[B]]$1[[/B]]');
  
  // Parse markers into segments
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
  
  // If no segments, return plain text
  if (segments.length === 0) {
    return [{ text: cleanTextForPDF(html), bold: false, italic: false }];
  }
  
  return segments;
};

/**
 * Load image as base64 with dimensions
 */
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
    // Header background
    doc.setFillColor(...COLORS.BACKGROUND);
    doc.rect(0, 0, PAGE.WIDTH, 16, "F");
    
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONTS.HEADER_TITLE);
    doc.setTextColor(...COLORS.PRIMARY);
    
    let title = isAnswerKey ? "GABARITO" : "SIMULADO ENEM";
    if (simuladoYear) title += ` ${simuladoYear}`;
    doc.text(title, PAGE.MARGIN_LEFT, 10);
    
    // Type subtitle
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
    doc.setTextColor(...COLORS.MUTED);
    doc.text(typeLabels[simuladoType] || "Simulado", PAGE.MARGIN_LEFT, 14);
    
    // Page number and question count
    doc.text(`Página ${currentPage}`, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 10, { align: "right" });
    if (!isAnswerKey) {
      doc.text(`${questions.length} questões`, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 14, { align: "right" });
    }
    
    // Separator
    doc.setDrawColor(...COLORS.BORDER);
    doc.setLineWidth(0.3);
    doc.line(PAGE.MARGIN_LEFT, 16, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 16);
  };

  const addFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.FOOTER);
    doc.setTextColor(...COLORS.LIGHT);
    doc.text("Aprendify - Seu parceiro de estudos para o ENEM", PAGE.WIDTH / 2, PAGE.HEIGHT - 8, { align: "center" });
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

  /**
   * Draw text with word wrapping, returns height used
   */
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

  /**
   * Draw formatted text with bold/italic support
   */
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
    
    // Build lines with proper word wrapping
    interface LineWord { text: string; bold: boolean; italic: boolean; }
    const lines: LineWord[][] = [];
    let currentLine: LineWord[] = [];
    let currentLineWidth = 0;
    
    for (const segment of segments) {
      // Split segment text into words, preserving spaces
      const parts = segment.text.split(/(\s+)/);
      
      for (const part of parts) {
        if (!part) continue;
        
        // Handle newlines
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
    
    // Draw lines
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

  /**
   * Draw an image, returns height used
   */
  const drawImage = (
    imageData: { data: string; width: number; height: number },
    x: number,
    startY: number,
    maxWidth: number,
    maxHeight: number = 60
  ): number => {
    try {
      const aspectRatio = imageData.height / imageData.width;
      let imgWidth = Math.min(maxWidth, imageData.width * 0.264583); // px to mm
      let imgHeight = imgWidth * aspectRatio;
      
      // Limit max height
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight / aspectRatio;
      }
      
      // Check page break
      if (startY + imgHeight + 4 > maxY) {
        doc.addPage();
        currentPage++;
        addHeader();
        startY = PAGE.MARGIN_TOP + 4;
      }
      
      // Center image
      const imgX = x + (maxWidth - imgWidth) / 2;
      
      // Draw border
      doc.setDrawColor(...COLORS.BORDER);
      doc.setLineWidth(0.2);
      doc.roundedRect(imgX - 1, startY - 1, imgWidth + 2, imgHeight + 2, 1, 1, "S");
      
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
    // Question images
    if (question.files && question.files.length > 0) {
      for (const file of question.files) {
        if (!imageCache.has(file)) {
          const img = await loadImageAsBase64(file);
          if (img) imageCache.set(file, img);
        }
      }
    }
    // Alternative images
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

    // Store for answer key
    if (question.correct_alternative) {
      answerKey.push({
        question: questionNumber,
        answer: question.correct_alternative.toUpperCase(),
        discipline: question.discipline,
      });
    }

    // Check minimum space for question header
    checkPageBreak(25);

    // ===== QUESTION HEADER =====
    
    // Number badge
    doc.setFillColor(...COLORS.PRIMARY);
    doc.roundedRect(PAGE.MARGIN_LEFT, yPosition, 20, 6, 1.5, 1.5, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONTS.QUESTION_NUMBER);
    doc.setTextColor(...COLORS.WHITE);
    doc.text(`Q${String(questionNumber).padStart(2, '0')}`, PAGE.MARGIN_LEFT + 10, yPosition + 4.2, { align: "center" });
    
    // Discipline and year
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.CAPTION);
    doc.setTextColor(...COLORS.MUTED);
    
    const disciplineName = formatDisciplineName(question.discipline);
    doc.text(`${disciplineName} • ENEM ${question.year}`, PAGE.MARGIN_LEFT + 24, yPosition + 4);
    
    yPosition += 10;

    // ===== CONTEXT (Texto de Apoio) =====
    
    if (question.context && question.context.trim()) {
      // Process context to separate main text from references
      const processed = separateTextAndReference(question.context);
      
      // Estimate context height
      doc.setFontSize(FONTS.CONTEXT);
      const contextLines = doc.splitTextToSize(cleanTextForPDF(processed.mainText), contentWidth - 10);
      const contextBoxHeight = (contextLines.length * SPACING.LINE_HEIGHT) + 8;
      
      checkPageBreak(Math.min(contextBoxHeight, 50));
      
      // Context box background
      doc.setFillColor(...COLORS.CONTEXT_BG);
      doc.setDrawColor(...COLORS.BORDER);
      doc.roundedRect(PAGE.MARGIN_LEFT, yPosition, contentWidth, contextBoxHeight, 2, 2, "FD");
      
      // Left accent bar
      doc.setFillColor(...COLORS.PRIMARY);
      doc.rect(PAGE.MARGIN_LEFT, yPosition, 2, contextBoxHeight, "F");
      
      // Context text
      const contextHeight = drawFormattedText(
        processed.mainText,
        PAGE.MARGIN_LEFT + 6,
        yPosition + 4,
        contentWidth - 12,
        FONTS.CONTEXT,
        COLORS.MUTED
      );
      
      yPosition += Math.max(contextHeight + 6, contextBoxHeight) + SPACING.PARAGRAPH;
      
      // Reference (if exists)
      if (processed.reference) {
        checkPageBreak(8);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(FONTS.CAPTION);
        doc.setTextColor(...COLORS.LIGHT);
        const refLines = doc.splitTextToSize(processed.reference, contentWidth - 8);
        refLines.forEach((line: string) => {
          doc.text(line, PAGE.MARGIN_LEFT + 4, yPosition);
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
      COLORS.TEXT
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
        FONTS.ALTERNATIVE_INTRO,
        COLORS.TEXT
      );
      
      yPosition += introHeight + SPACING.PARAGRAPH;
    }

    // ===== ALTERNATIVES =====
    
    for (const alt of question.alternatives) {
      checkPageBreak(12);
      
      const altX = PAGE.MARGIN_LEFT + 8;
      
      // Letter bubble
      doc.setDrawColor(...COLORS.BORDER);
      doc.setFillColor(...COLORS.WHITE);
      doc.setLineWidth(0.4);
      doc.circle(PAGE.MARGIN_LEFT + 3, yPosition + 1.5, 2.8, "FD");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONTS.ALTERNATIVE - 0.5);
      doc.setTextColor(...COLORS.PRIMARY);
      doc.text(alt.letter.toUpperCase(), PAGE.MARGIN_LEFT + 3, yPosition + 2.5, { align: "center" });
      
      // Alternative text
      const altTextHeight = drawFormattedText(
        alt.text,
        altX,
        yPosition,
        contentWidth - 12,
        FONTS.ALTERNATIVE,
        COLORS.TEXT
      );
      
      yPosition += Math.max(altTextHeight, SPACING.LINE_HEIGHT);
      
      // Alternative images (if any)
      if (alt.files && alt.files.length > 0) {
        for (const file of alt.files) {
          const img = imageCache.get(file);
          if (img) {
            const imgHeight = drawImage(img, altX, yPosition, contentWidth - 16, 40);
            yPosition += imgHeight;
          }
        }
      }
      
      yPosition += SPACING.ALTERNATIVE_GAP;
    }
    
    // Question separator
    if (i < questions.length - 1) {
      yPosition += 3;
      doc.setDrawColor(...COLORS.BORDER);
      doc.setLineWidth(0.15);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(PAGE.MARGIN_LEFT + 30, yPosition, PAGE.WIDTH - PAGE.MARGIN_RIGHT - 30, yPosition);
      doc.setLineDashPattern([], 0);
      yPosition += SPACING.QUESTION_GAP;
    }
  }

  // ============= ANSWER KEY =============
  
  doc.addPage();
  currentPage++;
  addHeader(true);
  yPosition = PAGE.MARGIN_TOP + 8;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.PRIMARY);
  doc.text("Gabarito Oficial", PAGE.WIDTH / 2, yPosition, { align: "center" });
  yPosition += 6;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONTS.CAPTION);
  doc.setTextColor(...COLORS.MUTED);
  doc.text(
    `${questions.length} questões • Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    PAGE.WIDTH / 2, yPosition, { align: "center" }
  );
  yPosition += 10;

  // Answer grid - 10 columns
  const gridCols = 10;
  const cellWidth = contentWidth / gridCols;
  const cellHeight = 9;
  
  // Grid header
  doc.setFillColor(...COLORS.PRIMARY);
  doc.rect(PAGE.MARGIN_LEFT, yPosition, contentWidth, 7, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONTS.CAPTION);
  doc.setTextColor(...COLORS.WHITE);
  
  for (let col = 0; col < gridCols; col++) {
    const colX = PAGE.MARGIN_LEFT + col * cellWidth + cellWidth / 2;
    doc.text("Nº", colX - 5, yPosition + 2.5);
    doc.text("R", colX + 4, yPosition + 2.5);
  }
  yPosition += 7;

  // Answer rows
  const rows = Math.ceil(answerKey.length / gridCols);
  
  for (let row = 0; row < rows; row++) {
    checkPageBreak(cellHeight);
    
    // Alternating background
    if (row % 2 === 0) {
      doc.setFillColor(...COLORS.BACKGROUND);
      doc.rect(PAGE.MARGIN_LEFT, yPosition, contentWidth, cellHeight, "F");
    }
    
    // Row border
    doc.setDrawColor(...COLORS.BORDER);
    doc.setLineWidth(0.15);
    doc.rect(PAGE.MARGIN_LEFT, yPosition, contentWidth, cellHeight, "S");
    
    for (let col = 0; col < gridCols; col++) {
      const idx = row * gridCols + col;
      if (idx >= answerKey.length) break;
      
      const item = answerKey[idx];
      const colX = PAGE.MARGIN_LEFT + col * cellWidth;
      
      // Column separator
      if (col > 0) {
        doc.line(colX, yPosition, colX, yPosition + cellHeight);
      }
      
      // Question number
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONTS.CAPTION);
      doc.setTextColor(...COLORS.TEXT);
      doc.text(String(item.question).padStart(2, '0'), colX + cellWidth / 2 - 5, yPosition + 5.5, { align: "center" });
      
      // Answer circle
      doc.setFillColor(...COLORS.CORRECT);
      doc.circle(colX + cellWidth / 2 + 5, yPosition + 4.5, 2.8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONTS.CAPTION);
      doc.setTextColor(...COLORS.WHITE);
      doc.text(item.answer, colX + cellWidth / 2 + 5, yPosition + 5.5, { align: "center" });
    }
    
    yPosition += cellHeight;
  }

  // Discipline summary
  yPosition += 12;
  checkPageBreak(40);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.PRIMARY);
  doc.text("Resumo por Área", PAGE.MARGIN_LEFT, yPosition);
  yPosition += 8;
  
  const disciplineCounts: Record<string, number> = {};
  answerKey.forEach(item => {
    const disc = formatDisciplineName(item.discipline);
    disciplineCounts[disc] = (disciplineCounts[disc] || 0) + 1;
  });
  
  const disciplines = Object.entries(disciplineCounts);
  const cols = Math.min(disciplines.length, 2);
  const boxWidth = (contentWidth - 8) / cols;
  
  let boxX = PAGE.MARGIN_LEFT;
  
  disciplines.forEach(([disc, count], idx) => {
    if (idx % 2 === 0 && idx > 0) {
      boxX = PAGE.MARGIN_LEFT;
      yPosition += 16;
    }
    
    doc.setFillColor(...COLORS.BACKGROUND);
    doc.setDrawColor(...COLORS.BORDER);
    doc.roundedRect(boxX, yPosition, boxWidth - 4, 12, 2, 2, "FD");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.CAPTION);
    doc.setTextColor(...COLORS.MUTED);
    doc.text(disc, boxX + 4, yPosition + 5);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.PRIMARY);
    doc.text(`${count}`, boxX + boxWidth - 10, yPosition + 8, { align: "right" });
    
    boxX += boxWidth;
  });

  // Add footers to all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter();
  }

  // Save
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `simulado-enem${simuladoYear ? `-${simuladoYear}` : ""}-${timestamp}.pdf`;
  console.log(`[PDF] Saving: ${filename}`);
  doc.save(filename);
};
