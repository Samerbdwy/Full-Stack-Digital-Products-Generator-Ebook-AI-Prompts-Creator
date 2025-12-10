import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generatePdf = async (ebook, ebookId) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📄 Starting PDF generation for ebook: "${ebook.title}"`);
      console.log(`   Number of chapters: ${ebook.chapters.length}`);
      
      const doc = new PDFDocument({ 
        margin: 72,
        size: 'A4',
        bufferPages: true
      });
      
      // Ensure directories exist
      const publicDir = path.join(__dirname, '..', 'public');
      const ebooksDir = path.join(publicDir, 'ebooks');
      
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      if (!fs.existsSync(ebooksDir)) fs.mkdirSync(ebooksDir, { recursive: true });

      const filePath = path.join(ebooksDir, `${ebookId}.pdf`);
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // === COVER PAGE ===
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fillColor('#1e40af')
         .text(ebook.title, 72, 200, { 
           align: 'center', 
           width: doc.page.width - 144 
         });
      
      doc.moveDown(3);
      doc.fontSize(18)
         .font('Helvetica')
         .fillColor('#4b5563')
         .text(ebook.description, {
           align: 'center',
           width: doc.page.width - 144,
           lineGap: 10
         });

      // Add a new page for Table of Contents
      doc.addPage();

      // === TABLE OF CONTENTS ===
      doc.fontSize(28) // Larger font size for TOC title
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('Table of Contents', 72, 100, {
           align: 'left'
         });
      
      doc.moveDown(1); // More space after TOC title
      
      let tocY = doc.y;
      
      ebook.chapters.forEach((chapter, index) => {
        // Check if we need a new page for TOC
        if (tocY > doc.page.height - 100) {
          doc.addPage();
          tocY = 100;
        }
        
        doc.fontSize(12) // Slightly larger font for TOC entries
           .font('Helvetica')
           .fillColor('#1e40af'); // Use primary color for TOC entries
        
        doc.text(chapter.title, 72, tocY, {
          width: doc.page.width - 144,
          lineGap: 5 // Add some line gap for readability
        });
        
        tocY = doc.y + 10; // Update tocY based on current Y position + padding
      });

      // === CHAPTERS ===
      ebook.chapters.forEach((chapter, chapterIndex) => {
        // Start each chapter on a new page.
        doc.addPage();
        
        // Chapter Title
        doc.fontSize(22) // Larger chapter number
           .font('Helvetica-Bold')
           .fillColor('#1e40af')
           .text(`Chapter ${chapterIndex + 1}`, { align: 'left' });

        doc.moveDown(0.75); // More space after chapter number

        const chapterTitle = chapter.title; // Use full chapter title for header
        doc.fontSize(20) // Larger chapter title
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text(chapterTitle, {
             width: doc.page.width - 144
           });

        doc.moveDown(1.5);


        // Chapter Content
        if (chapter.content) {
          doc.fontSize(11)
             .font('Helvetica')
             .fillColor('#000000');

          const paragraphs = chapter.content.split('\n\n');
          paragraphs.forEach((paragraph, paraIndex) => {
            doc.text(paragraph, {
              width: doc.page.width - 144,
              lineGap: 5,
              align: 'justify'
            });
            if (paraIndex < paragraphs.length - 1) {
              doc.moveDown(0.5);
            }
          });
        }
        
        // Helper function to add sections with proper page management
        const addSection = (title, items, color = '#555555') => {
          if (!items || items.length === 0) return;
          
          const sectionTitleHeight = 30;
          const itemsHeight = items.reduce((acc, item) => {
            return acc + doc.heightOfString(`• ${item}`, {
              width: doc.page.width - 144 - 20,
              lineGap: 3
            }) + 5; // item height + gap
          }, 0);

          if (doc.y + sectionTitleHeight + itemsHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
          }
          
          doc.moveDown(1.5);
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor('#1e40af')
             .text(title);
          doc.moveDown(0.5);
          
          doc.fontSize(10).font('Helvetica').fillColor(color);
          items.forEach(item => {
            doc.text(`• ${item}`, {
                width: doc.page.width - 144 - 20,
                indent: 20,
                lineGap: 3
            });
            doc.moveDown(0.25);
          });
        };
        
        addSection('Key Sections:', chapter.subheadings || [], '#374151');
        addSection('Examples:', chapter.examples || [], '#059669');
        addSection('Key Takeaways:', chapter.keyTakeaways || [], '#dc2626');
        
        // Add a decorative separator between chapters (optional)
        if (chapterIndex < ebook.chapters.length - 1) {
           if (doc.y + 50 > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
          }
          doc.moveDown(2);
          doc.fontSize(14)
             .font('Helvetica-Oblique')
             .fillColor('#6b7280')
             .text('• • •', { 
               align: 'center'
             });
        }
      });

      // === FINAL PAGE ===
      doc.addPage();
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor('#1e40af')
         .text('Thank You for Reading!', { 
           align: 'center',
           y: doc.page.height / 2 - 50
         });
      
      doc.moveDown(1);
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#4b5563')
         .text('We hope you found this ebook valuable and actionable.', { 
           align: 'center'
         });
      
      doc.moveDown(2);
      doc.fontSize(12)
         .font('Helvetica-Oblique')
         .fillColor('#6b7280')
         .text('Thanks for reading', { 
           align: 'center'
         });

      // Finalize the PDF
      doc.end();

      stream.on('finish', () => {
        // Get actual page count
        const pageCount = doc.bufferedPageRange().count;
        console.log(`✅ PDF generated successfully: ${filePath}`);
        
        
        const pdfUrl = `/ebooks/${ebookId}.pdf`;
        resolve(pdfUrl);
      });

      stream.on('error', (err) => {
        console.error('❌ PDF stream error:', err);
        reject(err);
      });
    } catch (error) {
      console.error('❌ PDF generation error:', error);
      reject(error);
    }
  });
};

export default generatePdf;