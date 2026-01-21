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

/**
 * Strip HTML tags for plain text
 */
const stripHtml = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

/**
 * Parse text with formatting (bold, italic) and return segments
 */
interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

const parseFormattedText = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  
  // Simple regex-based parsing for common patterns
  // Handle <strong>, <b>, <em>, <i>, **bold**, *italic*, _italic_
  let remaining = text;
  
  // First, convert HTML tags to markers
  remaining = remaining
    .replace(/<strong>/gi, '{{BOLD_START}}')
    .replace(/<\/strong>/gi, '{{BOLD_END}}')
    .replace(/<b>/gi, '{{BOLD_START}}')
    .replace(/<\/b>/gi, '{{BOLD_END}}')
    .replace(/<em>/gi, '{{ITALIC_START}}')
    .replace(/<\/em>/gi, '{{ITALIC_END}}')
    .replace(/<i>/gi, '{{ITALIC_START}}')
    .replace(/<\/i>/gi, '{{ITALIC_END}}');
  
  // Clean other HTML
  remaining = stripHtml(remaining);
  
  // Handle markdown-style formatting
  // **bold** or __bold__
  remaining = remaining.replace(/\*\*([^*]+)\*\*/g, '{{BOLD_START}}$1{{BOLD_END}}');
  remaining = remaining.replace(/__([^_]+)__/g, '{{BOLD_START}}$1{{BOLD_END}}');
  
  // *italic* or _italic_ (but not inside words)
  remaining = remaining.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '{{ITALIC_START}}$1{{ITALIC_END}}');
  remaining = remaining.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '{{ITALIC_START}}$1{{ITALIC_END}}');
  
  // Now parse the markers
  let currentBold = false;
  let currentItalic = false;
  let buffer = '';
  
  const pushSegment = () => {
    if (buffer) {
      segments.push({
        text: buffer,
        bold: currentBold,
        italic: currentItalic,
      });
      buffer = '';
    }
  };
  
  let i = 0;
  while (i < remaining.length) {
    if (remaining.substring(i, i + 14) === '{{BOLD_START}}') {
      pushSegment();
      currentBold = true;
      i += 14;
    } else if (remaining.substring(i, i + 12) === '{{BOLD_END}}') {
      pushSegment();
      currentBold = false;
      i += 12;
    } else if (remaining.substring(i, i + 16) === '{{ITALIC_START}}') {
      pushSegment();
      currentItalic = true;
      i += 16;
    } else if (remaining.substring(i, i + 14) === '{{ITALIC_END}}') {
      pushSegment();
      currentItalic = false;
      i += 14;
    } else {
      buffer += remaining[i];
      i++;
    }
  }
  pushSegment();
  
  return segments.length > 0 ? segments : [{ text: text, bold: false, italic: false }];
};

/**
 * Load image as base64 for PDF embedding
 */
const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    // Handle Supabase storage URLs
    let finalUrl = url;
    if (url.startsWith('/') || !url.startsWith('http')) {
      // Relative URL - try to construct full URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl && url.includes('enem-images')) {
        finalUrl = `${supabaseUrl}/storage/v1/object/public/${url}`;
      } else {
        return null;
      }
    }
    
    const response = await fetch(finalUrl);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[PDF] Failed to load image:', url, error);
    return null;
  }
};

/**
 * Generate a 2-column ENEM-style PDF for a simulado
 * Optimized for tablet users who want to mark/annotate the PDF
 * Now with image support, text formatting, and answer key
 */
export const generateSimuladoPDF = async (
  questions: QuestionData[],
  simuladoType: string,
  simuladoYear?: string | null
): Promise<void> => {
  // Create PDF in A4 portrait
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const columnWidth = (pageWidth - margin * 3) / 2;
  const columnGap = margin;
  const contentWidth = columnWidth - 4;

  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246];
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];
  const borderColor: [number, number, number] = [229, 231, 235];
  const correctColor: [number, number, number] = [34, 197, 94]; // Green

  // Fonts
  const titleFontSize = 14;
  const subtitleFontSize = 10;
  const questionFontSize = 9;
  const alternativeFontSize = 8.5;
  const lineHeight = 4;

  let currentPage = 1;
  let currentColumn = 0;
  let yPosition = margin + 30;

  // Store answers for the answer key
  const answerKey: { question: number; answer: string; discipline: string }[] = [];

  const getColumnX = () => {
    return currentColumn === 0 
      ? margin 
      : margin + columnWidth + columnGap;
  };

  const addHeader = (isAnswerKey = false) => {
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, pageWidth, 25, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleFontSize);
    doc.setTextColor(...primaryColor);
    
    let title = isAnswerKey ? "GABARITO - Simulado ENEM" : "Simulado ENEM";
    if (simuladoYear) {
      title += ` ${simuladoYear}`;
    }
    doc.text(title, margin, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(subtitleFontSize);
    doc.setTextColor(...mutedColor);
    
    const typeLabels: Record<string, string> = {
      official_day1: "Dia 1 - Linguagens e Ciências Humanas",
      official_day2: "Dia 2 - Matemática e Ciências da Natureza",
      custom_naturezas: "Ciências da Natureza",
      custom_humanas: "Ciências Humanas",
      custom_matematica: "Matemática",
      custom_mixed: "Simulado Misto"
    };
    
    const subtitle = `${typeLabels[simuladoType] || "Simulado"} • ${questions.length} questões`;
    doc.text(subtitle, margin, 19);

    doc.setFontSize(9);
    doc.text(`Página ${currentPage}`, pageWidth - margin, 19, { align: "right" });

    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.line(margin, 24, pageWidth - margin, 24);
  };

  const addFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text("Aprendify - Seu parceiro de estudos para o ENEM", pageWidth / 2, pageHeight - 8, { align: "center" });
  };

  const checkSpace = (requiredHeight: number) => {
    const maxY = pageHeight - margin - 15;
    
    if (yPosition + requiredHeight > maxY) {
      if (currentColumn === 0) {
        currentColumn = 1;
        yPosition = margin + 30;
      } else {
        doc.addPage();
        currentPage++;
        currentColumn = 0;
        yPosition = margin + 30;
        addHeader();
      }
    }
  };

  const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    doc.setFontSize(fontSize);
    const cleanText = stripHtml(text);
    return doc.splitTextToSize(cleanText, maxWidth);
  };

  /**
   * Draw formatted text with bold/italic support
   */
  const drawFormattedText = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    baseColor: [number, number, number]
  ): number => {
    const segments = parseFormattedText(text);
    const lines: { segments: TextSegment[]; }[] = [];
    let currentLine: TextSegment[] = [];
    let currentLineWidth = 0;
    
    doc.setFontSize(fontSize);
    
    // Simple line breaking - split by words
    for (const segment of segments) {
      const words = segment.text.split(/(\s+)/);
      
      for (const word of words) {
        if (!word) continue;
        
        const fontStyle = segment.bold && segment.italic ? 'bolditalic' : 
                          segment.bold ? 'bold' : 
                          segment.italic ? 'italic' : 'normal';
        doc.setFont("helvetica", fontStyle);
        
        const wordWidth = doc.getTextWidth(word);
        
        if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
          lines.push({ segments: [...currentLine] });
          currentLine = [];
          currentLineWidth = 0;
        }
        
        currentLine.push({ ...segment, text: word });
        currentLineWidth += wordWidth;
      }
    }
    
    if (currentLine.length > 0) {
      lines.push({ segments: currentLine });
    }
    
    // Draw lines
    let currentY = y;
    for (const line of lines) {
      let currentX = x;
      
      for (const seg of line.segments) {
        const fontStyle = seg.bold && seg.italic ? 'bolditalic' : 
                          seg.bold ? 'bold' : 
                          seg.italic ? 'italic' : 'normal';
        doc.setFont("helvetica", fontStyle);
        doc.setTextColor(...baseColor);
        doc.text(seg.text, currentX, currentY);
        currentX += doc.getTextWidth(seg.text);
      }
      
      currentY += lineHeight;
    }
    
    return lines.length * lineHeight;
  };

  // Pre-load images for questions that have them
  const imageCache: Map<string, string> = new Map();
  
  for (const question of questions) {
    if (question.files && question.files.length > 0) {
      for (const file of question.files) {
        if (!imageCache.has(file)) {
          const base64 = await loadImageAsBase64(file);
          if (base64) {
            imageCache.set(file, base64);
          }
        }
      }
    }
  }

  // Add initial header
  addHeader();

  // Process each question
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionNumber = i + 1;

    // Store answer for key
    if (question.correct_alternative) {
      answerKey.push({
        question: questionNumber,
        answer: question.correct_alternative.toUpperCase(),
        discipline: question.discipline,
      });
    }

    // Calculate height
    const titleLines = wrapText(question.title, contentWidth, questionFontSize);
    const contextLines = question.context 
      ? wrapText(question.context.substring(0, 500) + (question.context.length > 500 ? "..." : ""), contentWidth, questionFontSize - 1) 
      : [];
    
    let estimatedHeight = 12;
    estimatedHeight += titleLines.length * lineHeight;
    estimatedHeight += contextLines.length * (lineHeight - 0.5);
    
    // Add height for images
    if (question.files && question.files.length > 0) {
      estimatedHeight += 35; // Approximate image height
    }
    
    question.alternatives.forEach(alt => {
      const altLines = wrapText(`${alt.letter}) ${alt.text}`, contentWidth - 4, alternativeFontSize);
      estimatedHeight += altLines.length * (lineHeight - 0.5) + 2;
    });
    
    estimatedHeight += 8;

    checkSpace(estimatedHeight);

    const x = getColumnX();

    // Question box
    doc.setFillColor(250, 250, 252);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(x, yPosition, contentWidth + 4, estimatedHeight - 4, 2, 2, "FD");

    yPosition += 4;

    // Question number
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text(`Questão ${questionNumber}`, x + 3, yPosition + 3);

    // Discipline badge
    const disciplineName = formatDisciplineName(question.discipline);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...mutedColor);
    doc.text(disciplineName, x + contentWidth, yPosition + 3, { align: "right" });

    yPosition += 8;

    // Context
    if (question.context && question.context.trim()) {
      const heightUsed = drawFormattedText(
        question.context.length > 400 ? question.context.substring(0, 400) + "..." : question.context,
        x + 3,
        yPosition,
        contentWidth - 4,
        questionFontSize - 1,
        mutedColor
      );
      yPosition += heightUsed + 2;
    }

    // Images
    if (question.files && question.files.length > 0) {
      for (const file of question.files) {
        const base64 = imageCache.get(file);
        if (base64) {
          try {
            const imgWidth = Math.min(contentWidth - 10, 60);
            const imgHeight = 30;
            doc.addImage(base64, 'JPEG', x + 3, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 3;
          } catch (error) {
            console.warn('[PDF] Failed to add image:', error);
          }
        }
      }
    }

    // Title/statement with formatting
    const titleHeight = drawFormattedText(
      question.title,
      x + 3,
      yPosition,
      contentWidth - 4,
      questionFontSize,
      textColor
    );
    yPosition += titleHeight + 3;

    // Alternatives
    question.alternatives.forEach(alt => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(alternativeFontSize);
      doc.setTextColor(...textColor);
      
      const altText = `${alt.letter}) ${alt.text}`;
      const altLines = wrapText(altText, contentWidth - 8, alternativeFontSize);
      
      // Answer circle
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.3);
      doc.circle(x + 5, yPosition - 1.5, 1.8, "S");
      
      altLines.forEach((line, lineIdx) => {
        doc.text(line, x + 10, yPosition);
        yPosition += lineHeight - 0.5;
      });
      
      yPosition += 1;
    });

    yPosition += 6;
  }

  // ===== ANSWER KEY PAGE =====
  doc.addPage();
  currentPage++;
  currentColumn = 0;
  yPosition = margin + 30;
  
  addHeader(true);
  
  // Answer key grid
  const gridCols = 5;
  const cellWidth = (pageWidth - margin * 2) / gridCols;
  const cellHeight = 12;
  
  yPosition += 5;
  
  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text("Gabarito Oficial", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 8;
  
  // Grid header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  
  for (let col = 0; col < gridCols; col++) {
    const colX = margin + col * cellWidth;
    doc.text("Questão", colX + 2, yPosition);
    doc.text("Resp.", colX + cellWidth - 15, yPosition);
  }
  yPosition += 4;
  
  // Draw answers in grid
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  const rows = Math.ceil(answerKey.length / gridCols);
  
  for (let row = 0; row < rows; row++) {
    // Check if we need a new page
    if (yPosition + cellHeight > pageHeight - margin - 20) {
      doc.addPage();
      currentPage++;
      addHeader(true);
      yPosition = margin + 40;
    }
    
    for (let col = 0; col < gridCols; col++) {
      const idx = row * gridCols + col;
      if (idx >= answerKey.length) break;
      
      const item = answerKey[idx];
      const colX = margin + col * cellWidth;
      
      // Alternate row colors
      if (row % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(colX, yPosition - 3, cellWidth - 2, cellHeight, "F");
      }
      
      // Question number
      doc.setTextColor(...textColor);
      doc.setFont("helvetica", "normal");
      doc.text(String(item.question).padStart(2, '0'), colX + 4, yPosition + 4);
      
      // Answer in green circle
      doc.setFillColor(...correctColor);
      doc.circle(colX + cellWidth - 10, yPosition + 2, 4, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text(item.answer, colX + cellWidth - 10, yPosition + 4, { align: "center" });
    }
    
    yPosition += cellHeight;
  }
  
  // Summary by discipline
  yPosition += 10;
  
  if (yPosition + 50 > pageHeight - margin - 20) {
    doc.addPage();
    currentPage++;
    addHeader(true);
    yPosition = margin + 40;
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text("Resumo por Disciplina", margin, yPosition);
  yPosition += 6;
  
  // Count by discipline
  const disciplineCounts: Record<string, number> = {};
  answerKey.forEach(item => {
    const disc = formatDisciplineName(item.discipline);
    disciplineCounts[disc] = (disciplineCounts[disc] || 0) + 1;
  });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...textColor);
  
  Object.entries(disciplineCounts).forEach(([disc, count]) => {
    doc.text(`• ${disc}: ${count} questões`, margin + 4, yPosition);
    yPosition += 5;
  });
  
  // Add footer to all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter();
  }

  // Generate filename
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `simulado-enem${simuladoYear ? `-${simuladoYear}` : ""}-${timestamp}.pdf`;

  // Save PDF
  doc.save(filename);
};
