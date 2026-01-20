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
}

/**
 * Generate a 2-column ENEM-style PDF for a simulado
 * Optimized for tablet users who want to mark/annotate the PDF
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
  const columnWidth = (pageWidth - margin * 3) / 2; // 2 columns with gap
  const columnGap = margin;
  const contentWidth = columnWidth - 4;

  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const textColor: [number, number, number] = [31, 41, 55]; // Dark gray
  const mutedColor: [number, number, number] = [107, 114, 128]; // Gray
  const borderColor: [number, number, number] = [229, 231, 235]; // Light gray

  // Fonts
  const titleFontSize = 14;
  const subtitleFontSize = 10;
  const questionFontSize = 9;
  const alternativeFontSize = 8.5;
  const lineHeight = 4;

  let currentPage = 1;
  let currentColumn = 0; // 0 = left, 1 = right
  let yPosition = margin + 30; // Start after header

  // Get column X position
  const getColumnX = () => {
    return currentColumn === 0 
      ? margin 
      : margin + columnWidth + columnGap;
  };

  // Add header to page
  const addHeader = () => {
    // Header background
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, pageWidth, 25, "F");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleFontSize);
    doc.setTextColor(...primaryColor);
    
    let title = "Simulado ENEM";
    if (simuladoYear) {
      title += ` ${simuladoYear}`;
    }
    doc.text(title, margin, 12);

    // Subtitle with type and question count
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

    // Page number
    doc.setFontSize(9);
    doc.text(`Página ${currentPage}`, pageWidth - margin, 19, { align: "right" });

    // Separator line
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.line(margin, 24, pageWidth - margin, 24);
  };

  // Add footer to page
  const addFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text("Aprendify - Seu parceiro de estudos para o ENEM", pageWidth / 2, pageHeight - 8, { align: "center" });
  };

  // Check if we need a new column or page
  const checkSpace = (requiredHeight: number) => {
    const maxY = pageHeight - margin - 15; // Leave space for footer
    
    if (yPosition + requiredHeight > maxY) {
      if (currentColumn === 0) {
        // Move to right column
        currentColumn = 1;
        yPosition = margin + 30;
      } else {
        // New page
        doc.addPage();
        currentPage++;
        currentColumn = 0;
        yPosition = margin + 30;
        addHeader();
      }
    }
  };

  // Wrap text to fit column width
  const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, maxWidth);
  };

  // Add initial header
  addHeader();

  // Process each question
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionNumber = i + 1;

    // Calculate approximate height needed
    const titleLines = wrapText(question.title, contentWidth, questionFontSize);
    const contextLines = question.context 
      ? wrapText(question.context.substring(0, 500) + (question.context.length > 500 ? "..." : ""), contentWidth, questionFontSize - 1) 
      : [];
    
    let estimatedHeight = 12; // Header + spacing
    estimatedHeight += titleLines.length * lineHeight;
    estimatedHeight += contextLines.length * (lineHeight - 0.5);
    
    // Alternatives
    question.alternatives.forEach(alt => {
      const altLines = wrapText(`${alt.letter}) ${alt.text}`, contentWidth - 4, alternativeFontSize);
      estimatedHeight += altLines.length * (lineHeight - 0.5) + 2;
    });
    
    estimatedHeight += 8; // Bottom padding

    // Check space
    checkSpace(estimatedHeight);

    const x = getColumnX();

    // Question header box
    doc.setFillColor(250, 250, 252);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(x, yPosition, contentWidth + 4, estimatedHeight - 4, 2, 2, "FD");

    yPosition += 4;

    // Question number and discipline badge
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

    // Context (if exists)
    if (question.context && question.context.trim()) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(questionFontSize - 1);
      doc.setTextColor(...mutedColor);
      
      const truncatedContext = question.context.length > 400 
        ? question.context.substring(0, 400) + "..." 
        : question.context;
      const contextWrapped = wrapText(truncatedContext, contentWidth - 4, questionFontSize - 1);
      
      contextWrapped.forEach(line => {
        doc.text(line, x + 3, yPosition);
        yPosition += lineHeight - 0.5;
      });
      
      yPosition += 2;
    }

    // Question title/statement
    doc.setFont("helvetica", "normal");
    doc.setFontSize(questionFontSize);
    doc.setTextColor(...textColor);
    
    titleLines.forEach(line => {
      doc.text(line, x + 3, yPosition);
      yPosition += lineHeight;
    });

    yPosition += 3;

    // Alternatives
    question.alternatives.forEach(alt => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(alternativeFontSize);
      doc.setTextColor(...textColor);
      
      const altText = `${alt.letter}) ${alt.text}`;
      const altLines = wrapText(altText, contentWidth - 8, alternativeFontSize);
      
      // Draw answer circle
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.3);
      doc.circle(x + 5, yPosition - 1.5, 1.8, "S");
      
      altLines.forEach((line, lineIdx) => {
        const textX = lineIdx === 0 ? x + 10 : x + 10;
        doc.text(line, textX, yPosition);
        yPosition += lineHeight - 0.5;
      });
      
      yPosition += 1;
    });

    yPosition += 6; // Space between questions
  }

  // Add footer to last page
  addFooter();

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
