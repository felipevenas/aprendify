import jsPDF from "jspdf";
import { formatDisciplineName } from "@/lib/formatters";

interface Alternative {
  letter: string;
  text: string;
}

interface QuestionData {
  index: number;
  title: string;
  context: string | null;
  alternatives: Alternative[];
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
  MARGIN_BOTTOM: 20,
  MARGIN_LEFT: 18,
  MARGIN_RIGHT: 18,
} as const;

const COLORS = {
  PRIMARY: [37, 99, 235] as [number, number, number],      // Blue
  TEXT: [17, 24, 39] as [number, number, number],          // Gray-900
  MUTED: [107, 114, 128] as [number, number, number],      // Gray-500
  LIGHT: [156, 163, 175] as [number, number, number],      // Gray-400
  BORDER: [229, 231, 235] as [number, number, number],     // Gray-200
  BACKGROUND: [249, 250, 251] as [number, number, number], // Gray-50
  CORRECT: [22, 163, 74] as [number, number, number],      // Green-600
  WHITE: [255, 255, 255] as [number, number, number],
} as const;

const FONTS = {
  TITLE: 16,
  SUBTITLE: 11,
  QUESTION_NUMBER: 11,
  QUESTION_TEXT: 10,
  CONTEXT: 9,
  ALTERNATIVE: 9.5,
  CAPTION: 8,
  FOOTER: 7.5,
} as const;

const SPACING = {
  LINE_HEIGHT: 4.5,
  PARAGRAPH: 6,
  SECTION: 10,
  QUESTION_GAP: 12,
  ALTERNATIVE_GAP: 3,
} as const;

// ============= HELPERS =============

/**
 * Clean and decode HTML entities
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
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '...')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'");
};

/**
 * Strip HTML tags and normalize whitespace
 */
const stripHtml = (html: string): string => {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n');
  
  text = decodeHtmlEntities(text);
  
  // Normalize whitespace but preserve intentional line breaks
  return text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .trim();
};

/**
 * Text segment with formatting info
 */
interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Parse text for bold/italic formatting
 */
const parseFormattedText = (html: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  
  // Replace HTML tags with markers
  let text = html
    .replace(/<strong>/gi, '⟨B⟩')
    .replace(/<\/strong>/gi, '⟨/B⟩')
    .replace(/<b>/gi, '⟨B⟩')
    .replace(/<\/b>/gi, '⟨/B⟩')
    .replace(/<em>/gi, '⟨I⟩')
    .replace(/<\/em>/gi, '⟨/I⟩')
    .replace(/<i>/gi, '⟨I⟩')
    .replace(/<\/i>/gi, '⟨/I⟩');
  
  // Clean HTML but keep markers
  text = stripHtml(text);
  
  // Handle markdown **bold** and *italic*
  text = text.replace(/\*\*([^*]+)\*\*/g, '⟨B⟩$1⟨/B⟩');
  text = text.replace(/__([^_]+)__/g, '⟨B⟩$1⟨/B⟩');
  text = text.replace(/(?<![⟨\w])\*([^*]+)\*(?![⟩\w])/g, '⟨I⟩$1⟨/I⟩');
  text = text.replace(/(?<![⟨\w])_([^_]+)_(?![⟩\w])/g, '⟨I⟩$1⟨/I⟩');
  
  // Parse into segments
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
    if (text.substring(i, i + 3) === '⟨B⟩') {
      flush();
      bold = true;
      i += 3;
    } else if (text.substring(i, i + 4) === '⟨/B⟩') {
      flush();
      bold = false;
      i += 4;
    } else if (text.substring(i, i + 3) === '⟨I⟩') {
      flush();
      italic = true;
      i += 3;
    } else if (text.substring(i, i + 4) === '⟨/I⟩') {
      flush();
      italic = false;
      i += 4;
    } else {
      buffer += text[i];
      i++;
    }
  }
  flush();
  
  return segments.length > 0 ? segments : [{ text: stripHtml(html), bold: false, italic: false }];
};

/**
 * Load image as base64 with proper error handling
 */
const loadImageAsBase64 = async (url: string): Promise<{ data: string; width: number; height: number } | null> => {
  try {
    let finalUrl = url;
    
    // Handle relative URLs
    if (!url.startsWith('http')) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        // Remove leading slash if present
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
    
    const response = await fetch(finalUrl, { 
      mode: 'cors',
      cache: 'force-cache'
    });
    
    if (!response.ok) {
      console.warn(`[PDF] Image fetch failed: ${response.status} for ${finalUrl}`);
      return null;
    }
    
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      const img = new Image();
      
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        
        img.onload = () => {
          resolve({ 
            data: dataUrl, 
            width: img.naturalWidth, 
            height: img.naturalHeight 
          });
        };
        
        img.onerror = () => {
          // Still return the data even if we can't get dimensions
          resolve({ data: dataUrl, width: 200, height: 150 });
        };
        
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

/**
 * Get image format from base64 data URL
 */
const getImageFormat = (dataUrl: string): string => {
  if (dataUrl.includes('image/png')) return 'PNG';
  if (dataUrl.includes('image/gif')) return 'GIF';
  if (dataUrl.includes('image/webp')) return 'WEBP';
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

  // Answer key storage
  const answerKey: { question: number; answer: string; discipline: string }[] = [];

  // ============= HEADER/FOOTER =============
  
  const addHeader = (isAnswerKey = false) => {
    // Header background
    doc.setFillColor(...COLORS.BACKGROUND);
    doc.rect(0, 0, PAGE.WIDTH, 18, "F");
    
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONTS.TITLE);
    doc.setTextColor(...COLORS.PRIMARY);
    
    let title = isAnswerKey ? "GABARITO" : "SIMULADO ENEM";
    if (simuladoYear) title += ` ${simuladoYear}`;
    doc.text(title, PAGE.MARGIN_LEFT, 11);
    
    // Subtitle with type
    const typeLabels: Record<string, string> = {
      official_day1: "Dia 1 • Linguagens e Ciências Humanas",
      official_day2: "Dia 2 • Matemática e Ciências da Natureza",
      custom_naturezas: "Ciências da Natureza",
      custom_humanas: "Ciências Humanas",
      custom_matematica: "Matemática",
      custom_mixed: "Simulado Personalizado"
    };
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.CAPTION);
    doc.setTextColor(...COLORS.MUTED);
    
    const subtitle = typeLabels[simuladoType] || "Simulado";
    doc.text(subtitle, PAGE.MARGIN_LEFT, 15.5);
    
    // Page number
    doc.text(`Página ${currentPage}`, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 11, { align: "right" });
    
    // Question count
    if (!isAnswerKey) {
      doc.text(`${questions.length} questões`, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 15.5, { align: "right" });
    }
    
    // Separator line
    doc.setDrawColor(...COLORS.BORDER);
    doc.setLineWidth(0.4);
    doc.line(PAGE.MARGIN_LEFT, 18, PAGE.WIDTH - PAGE.MARGIN_RIGHT, 18);
  };

  const addFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.FOOTER);
    doc.setTextColor(...COLORS.LIGHT);
    doc.text(
      "Aprendify • Seu parceiro de estudos para o ENEM", 
      PAGE.WIDTH / 2, 
      PAGE.HEIGHT - 10, 
      { align: "center" }
    );
  };

  // ============= TEXT UTILITIES =============

  const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    doc.setFontSize(fontSize);
    const cleanText = stripHtml(text);
    return doc.splitTextToSize(cleanText, maxWidth);
  };

  const checkPageBreak = (requiredHeight: number): boolean => {
    if (yPosition + requiredHeight > maxY) {
      doc.addPage();
      currentPage++;
      addHeader();
      yPosition = PAGE.MARGIN_TOP + 8;
      return true;
    }
    return false;
  };

  /**
   * Draw formatted text with bold/italic support
   * Returns the height used
   */
  const drawFormattedText = (
    rawText: string,
    x: number,
    startY: number,
    maxWidth: number,
    fontSize: number,
    color: [number, number, number],
    checkBreaks = true
  ): number => {
    const segments = parseFormattedText(rawText);
    doc.setFontSize(fontSize);
    
    // Build lines with word wrapping
    interface LineWord {
      text: string;
      bold: boolean;
      italic: boolean;
    }
    
    const lines: LineWord[][] = [];
    let currentLine: LineWord[] = [];
    let currentLineWidth = 0;
    
    for (const segment of segments) {
      const words = segment.text.split(/(\s+)/);
      
      for (const word of words) {
        if (!word) continue;
        
        // Check for newlines
        if (word.includes('\n')) {
          const parts = word.split('\n');
          parts.forEach((part, idx) => {
            if (part) {
              const style = segment.bold && segment.italic ? 'bolditalic' : 
                           segment.bold ? 'bold' : 
                           segment.italic ? 'italic' : 'normal';
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
            
            if (idx < parts.length - 1) {
              if (currentLine.length > 0) {
                lines.push([...currentLine]);
                currentLine = [];
                currentLineWidth = 0;
              }
            }
          });
          continue;
        }
        
        const style = segment.bold && segment.italic ? 'bolditalic' : 
                     segment.bold ? 'bold' : 
                     segment.italic ? 'italic' : 'normal';
        doc.setFont("helvetica", style);
        const wordWidth = doc.getTextWidth(word);
        
        if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
          lines.push([...currentLine]);
          currentLine = [];
          currentLineWidth = 0;
        }
        
        currentLine.push({ text: word, bold: segment.bold, italic: segment.italic });
        currentLineWidth += wordWidth;
      }
    }
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    // Draw lines
    let y = startY;
    
    for (const line of lines) {
      if (checkBreaks && y + SPACING.LINE_HEIGHT > maxY) {
        doc.addPage();
        currentPage++;
        addHeader();
        y = PAGE.MARGIN_TOP + 8;
      }
      
      let currentX = x;
      
      for (const word of line) {
        const style = word.bold && word.italic ? 'bolditalic' : 
                     word.bold ? 'bold' : 
                     word.italic ? 'italic' : 'normal';
        doc.setFont("helvetica", style);
        doc.setTextColor(...color);
        doc.text(word.text, currentX, y);
        currentX += doc.getTextWidth(word.text);
      }
      
      y += SPACING.LINE_HEIGHT;
    }
    
    return y - startY;
  };

  // ============= PRE-LOAD IMAGES =============
  
  const imageCache: Map<string, { data: string; width: number; height: number }> = new Map();
  
  console.log('[PDF] Pre-loading images...');
  
  for (const question of questions) {
    if (question.files && question.files.length > 0) {
      for (const file of question.files) {
        if (!imageCache.has(file)) {
          const imageData = await loadImageAsBase64(file);
          if (imageData) {
            imageCache.set(file, imageData);
            console.log(`[PDF] Loaded image: ${file}`);
          }
        }
      }
    }
  }
  
  console.log(`[PDF] Loaded ${imageCache.size} images`);

  // ============= GENERATE QUESTIONS =============
  
  addHeader();
  yPosition = PAGE.MARGIN_TOP + 8;

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

    // ===== ESTIMATE HEIGHT =====
    let estimatedHeight = 20; // Base height for header
    
    // Context height
    if (question.context && question.context.trim()) {
      const contextText = question.context.length > 600 
        ? question.context.substring(0, 600) + "..." 
        : question.context;
      const contextLines = wrapText(contextText, contentWidth - 12, FONTS.CONTEXT);
      estimatedHeight += contextLines.length * SPACING.LINE_HEIGHT + SPACING.PARAGRAPH;
    }
    
    // Image height
    if (question.files && question.files.length > 0) {
      for (const file of question.files) {
        const img = imageCache.get(file);
        if (img) {
          const maxImgWidth = Math.min(contentWidth - 20, 100);
          const aspectRatio = img.height / img.width;
          const imgHeight = Math.min(maxImgWidth * aspectRatio, 70);
          estimatedHeight += imgHeight + SPACING.PARAGRAPH;
        }
      }
    }
    
    // Title height
    const titleLines = wrapText(question.title, contentWidth - 12, FONTS.QUESTION_TEXT);
    estimatedHeight += titleLines.length * SPACING.LINE_HEIGHT + SPACING.PARAGRAPH;
    
    // Alternatives height
    for (const alt of question.alternatives) {
      const altText = `${alt.letter}) ${alt.text}`;
      const altLines = wrapText(altText, contentWidth - 20, FONTS.ALTERNATIVE);
      estimatedHeight += altLines.length * SPACING.LINE_HEIGHT + SPACING.ALTERNATIVE_GAP;
    }
    
    estimatedHeight += SPACING.QUESTION_GAP;

    // Check if we need a page break
    checkPageBreak(Math.min(estimatedHeight, 80)); // At least start the question if it fits minimally

    const startY = yPosition;

    // ===== QUESTION HEADER =====
    
    // Question number badge
    doc.setFillColor(...COLORS.PRIMARY);
    doc.roundedRect(PAGE.MARGIN_LEFT, yPosition - 1, 22, 7, 1.5, 1.5, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONTS.QUESTION_NUMBER);
    doc.setTextColor(...COLORS.WHITE);
    doc.text(`Q${String(questionNumber).padStart(2, '0')}`, PAGE.MARGIN_LEFT + 11, yPosition + 4, { align: "center" });
    
    // Discipline label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.CAPTION);
    doc.setTextColor(...COLORS.MUTED);
    
    const disciplineName = formatDisciplineName(question.discipline);
    doc.text(disciplineName, PAGE.MARGIN_LEFT + 26, yPosition + 4);
    
    // Year
    if (question.year) {
      doc.text(`• ${question.year}`, PAGE.WIDTH - PAGE.MARGIN_RIGHT, yPosition + 4, { align: "right" });
    }
    
    yPosition += 12;

    // ===== CONTEXT =====
    
    if (question.context && question.context.trim()) {
      const contextText = question.context.length > 600 
        ? question.context.substring(0, 600) + "..." 
        : question.context;
      
      // Context box
      const contextLines = wrapText(contextText, contentWidth - 16, FONTS.CONTEXT);
      const contextHeight = contextLines.length * SPACING.LINE_HEIGHT + 8;
      
      checkPageBreak(contextHeight);
      
      doc.setFillColor(245, 247, 250);
      doc.setDrawColor(...COLORS.BORDER);
      doc.roundedRect(PAGE.MARGIN_LEFT + 4, yPosition - 2, contentWidth - 8, contextHeight, 2, 2, "FD");
      
      // Left accent bar
      doc.setFillColor(...COLORS.PRIMARY);
      doc.rect(PAGE.MARGIN_LEFT + 4, yPosition - 2, 2, contextHeight, "F");
      
      const textHeight = drawFormattedText(
        contextText,
        PAGE.MARGIN_LEFT + 10,
        yPosition + 3,
        contentWidth - 20,
        FONTS.CONTEXT,
        COLORS.MUTED
      );
      
      yPosition += Math.max(textHeight + 6, contextHeight) + SPACING.PARAGRAPH;
    }

    // ===== IMAGES =====
    
    if (question.files && question.files.length > 0) {
      for (const file of question.files) {
        const img = imageCache.get(file);
        if (img) {
          try {
            const maxImgWidth = Math.min(contentWidth - 20, 100);
            const aspectRatio = img.height / img.width;
            let imgWidth = maxImgWidth;
            let imgHeight = imgWidth * aspectRatio;
            
            // Limit max height
            if (imgHeight > 70) {
              imgHeight = 70;
              imgWidth = imgHeight / aspectRatio;
            }
            
            checkPageBreak(imgHeight + 8);
            
            // Center the image
            const imgX = PAGE.MARGIN_LEFT + (contentWidth - imgWidth) / 2;
            
            // Image border
            doc.setDrawColor(...COLORS.BORDER);
            doc.setLineWidth(0.3);
            doc.roundedRect(imgX - 2, yPosition - 2, imgWidth + 4, imgHeight + 4, 2, 2, "S");
            
            const format = getImageFormat(img.data);
            doc.addImage(img.data, format, imgX, yPosition, imgWidth, imgHeight);
            
            yPosition += imgHeight + SPACING.PARAGRAPH + 2;
          } catch (error) {
            console.warn('[PDF] Failed to add image:', file, error);
          }
        }
      }
    }

    // ===== QUESTION TITLE/STATEMENT =====
    
    checkPageBreak(20);
    
    const titleHeight = drawFormattedText(
      question.title,
      PAGE.MARGIN_LEFT + 4,
      yPosition,
      contentWidth - 8,
      FONTS.QUESTION_TEXT,
      COLORS.TEXT
    );
    
    yPosition += titleHeight + SPACING.PARAGRAPH;

    // ===== ALTERNATIVES =====
    
    for (const alt of question.alternatives) {
      checkPageBreak(12);
      
      const altX = PAGE.MARGIN_LEFT + 8;
      
      // Answer bubble
      doc.setDrawColor(...COLORS.BORDER);
      doc.setLineWidth(0.5);
      doc.setFillColor(...COLORS.WHITE);
      doc.circle(altX, yPosition + 1, 3, "FD");
      
      // Letter inside bubble
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONTS.ALTERNATIVE - 1);
      doc.setTextColor(...COLORS.PRIMARY);
      doc.text(alt.letter.toUpperCase(), altX, yPosition + 2, { align: "center" });
      
      // Alternative text
      const altHeight = drawFormattedText(
        alt.text,
        altX + 6,
        yPosition,
        contentWidth - 20,
        FONTS.ALTERNATIVE,
        COLORS.TEXT
      );
      
      yPosition += Math.max(altHeight, SPACING.LINE_HEIGHT) + SPACING.ALTERNATIVE_GAP;
    }
    
    // Separator line between questions
    if (i < questions.length - 1) {
      yPosition += 4;
      doc.setDrawColor(...COLORS.BORDER);
      doc.setLineWidth(0.2);
      doc.line(PAGE.MARGIN_LEFT + 20, yPosition, PAGE.WIDTH - PAGE.MARGIN_RIGHT - 20, yPosition);
      yPosition += SPACING.QUESTION_GAP;
    }
  }

  // ============= ANSWER KEY PAGE =============
  
  doc.addPage();
  currentPage++;
  addHeader(true);
  yPosition = PAGE.MARGIN_TOP + 12;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.PRIMARY);
  doc.text("Gabarito Oficial", PAGE.WIDTH / 2, yPosition, { align: "center" });
  yPosition += 10;
  
  // Info text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONTS.CAPTION);
  doc.setTextColor(...COLORS.MUTED);
  doc.text(
    `Total de ${questions.length} questões • Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    PAGE.WIDTH / 2,
    yPosition,
    { align: "center" }
  );
  yPosition += 12;

  // Answer grid - 10 columns for better layout
  const gridCols = 10;
  const cellWidth = (contentWidth - 4) / gridCols;
  const cellHeight = 10;
  
  // Header row
  doc.setFillColor(...COLORS.PRIMARY);
  doc.rect(PAGE.MARGIN_LEFT, yPosition, contentWidth, 8, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FONTS.CAPTION);
  doc.setTextColor(...COLORS.WHITE);
  
  for (let col = 0; col < gridCols; col++) {
    const colX = PAGE.MARGIN_LEFT + col * cellWidth + cellWidth / 2;
    doc.text("Nº", colX - 4, yPosition + 3);
    doc.text("R", colX + 4, yPosition + 3);
  }
  yPosition += 8;

  // Draw answer grid
  const rows = Math.ceil(answerKey.length / gridCols);
  
  for (let row = 0; row < rows; row++) {
    checkPageBreak(cellHeight + 2);
    
    // Alternate row background
    if (row % 2 === 0) {
      doc.setFillColor(...COLORS.BACKGROUND);
      doc.rect(PAGE.MARGIN_LEFT, yPosition, contentWidth, cellHeight, "F");
    }
    
    // Row border
    doc.setDrawColor(...COLORS.BORDER);
    doc.setLineWidth(0.2);
    doc.rect(PAGE.MARGIN_LEFT, yPosition, contentWidth, cellHeight, "S");
    
    for (let col = 0; col < gridCols; col++) {
      const idx = row * gridCols + col;
      if (idx >= answerKey.length) break;
      
      const item = answerKey[idx];
      const colX = PAGE.MARGIN_LEFT + col * cellWidth;
      
      // Column divider
      if (col > 0) {
        doc.line(colX, yPosition, colX, yPosition + cellHeight);
      }
      
      // Question number
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FONTS.CAPTION);
      doc.setTextColor(...COLORS.TEXT);
      doc.text(
        String(item.question).padStart(2, '0'),
        colX + cellWidth / 2 - 5,
        yPosition + 6.5,
        { align: "center" }
      );
      
      // Answer in colored circle
      doc.setFillColor(...COLORS.CORRECT);
      doc.circle(colX + cellWidth / 2 + 6, yPosition + 5, 3, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FONTS.CAPTION);
      doc.setTextColor(...COLORS.WHITE);
      doc.text(item.answer, colX + cellWidth / 2 + 6, yPosition + 6.2, { align: "center" });
    }
    
    yPosition += cellHeight;
  }

  // ===== SUMMARY BY DISCIPLINE =====
  
  yPosition += 15;
  checkPageBreak(50);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.PRIMARY);
  doc.text("Resumo por Área", PAGE.MARGIN_LEFT, yPosition);
  yPosition += 8;
  
  // Count by discipline
  const disciplineCounts: Record<string, number> = {};
  answerKey.forEach(item => {
    const disc = formatDisciplineName(item.discipline);
    disciplineCounts[disc] = (disciplineCounts[disc] || 0) + 1;
  });
  
  // Draw discipline summary boxes
  const disciplines = Object.entries(disciplineCounts);
  const boxWidth = (contentWidth - 8) / Math.min(disciplines.length, 2);
  
  let boxX = PAGE.MARGIN_LEFT;
  let boxY = yPosition;
  
  disciplines.forEach(([disc, count], idx) => {
    if (idx % 2 === 0 && idx > 0) {
      boxX = PAGE.MARGIN_LEFT;
      boxY += 18;
    }
    
    doc.setFillColor(...COLORS.BACKGROUND);
    doc.setDrawColor(...COLORS.BORDER);
    doc.roundedRect(boxX, boxY, boxWidth - 4, 14, 2, 2, "FD");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTS.CAPTION);
    doc.setTextColor(...COLORS.MUTED);
    doc.text(disc, boxX + 4, boxY + 6);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FONTS.SUBTITLE);
    doc.setTextColor(...COLORS.PRIMARY);
    doc.text(`${count} questões`, boxX + boxWidth - 8, boxY + 10, { align: "right" });
    
    boxX += boxWidth;
  });

  // ============= ADD FOOTERS TO ALL PAGES =============
  
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter();
  }

  // ============= SAVE PDF =============
  
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `simulado-enem${simuladoYear ? `-${simuladoYear}` : ""}-${timestamp}.pdf`;
  
  console.log(`[PDF] Saving: ${filename}`);
  doc.save(filename);
};
