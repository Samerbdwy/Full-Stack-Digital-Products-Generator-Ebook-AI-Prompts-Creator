import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generatePromptsPdf = async (topic, prompts, promptId) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📄 Starting PDF generation for prompts: "${topic}"`);
      
      const doc = new PDFDocument({ 
        margin: 72,
        size: 'A4',
        bufferPages: true
      });
      
      // Ensure directories exist
      const publicDir = path.join(__dirname, '..', 'public');
      const promptsDir = path.join(publicDir, 'prompts');
      
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      if (!fs.existsSync(promptsDir)) fs.mkdirSync(promptsDir, { recursive: true });

      const filePath = path.join(promptsDir, `${promptId}.pdf`);
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // === COVER PAGE ===
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fillColor('#1e40af')
         .text(`100 AI Prompts for`, 72, 200, { 
           align: 'center', 
           width: doc.page.width - 144 
         });
      
      doc.moveDown(1);
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text(topic, {
           align: 'center',
           width: doc.page.width - 144
         });

      // Add a new page for the prompts
      doc.addPage();

      // === PROMPTS ===
      doc.fontSize(22)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('100 AI Prompts', { align: 'left' });

      doc.moveDown(1.5);

      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#000000');

      prompts.forEach((prompt, index) => {
        if (doc.y > doc.page.height - 50) {
            doc.addPage();
        }
        doc.text(`${index + 1}. ${prompt}`, {
          width: doc.page.width - 144,
          lineGap: 5,
          align: 'left'
        });
        doc.moveDown(0.5);
      });

      // Finalize the PDF
      doc.end();

      stream.on('finish', () => {
        console.log(`✅ PDF generated successfully: ${filePath}`);
        
        const pdfUrl = `/prompts/${promptId}.pdf`;
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

export default generatePromptsPdf;
