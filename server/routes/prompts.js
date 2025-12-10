import express from 'express';
import Prompt from '../models/Prompt.js';
import geminiService from '../services/geminiService.js';
import { protect } from '../middleware/authMiddleware.js';
import generatePromptsPdf from '../utils/promptPdfGenerator.js';

const router = express.Router();

// Generate AI prompts - REMOVE CREDIT CHECKS
router.post('/generate', protect, async (req, res) => {
  try {
    const { topic, count = 100 } = req.body;
    const userId = req.user._id;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    // REMOVED: All credit checks and deductions

    // Create prompt record
    const promptDoc = new Prompt({
      topic,
      status: 'generating',
      user: userId
    });

    await promptDoc.save();

    // Generate prompts (in background) - NO CREDIT DEDUCTION
    generatePrompts(promptDoc._id, topic, count);

    res.json({
      message: 'AI prompts generation started',
      promptId: promptDoc._id,
      status: 'generating'
      // REMOVED: credits from response
    });

  } catch (error) {
    console.error('Prompts generation error:', error);
    res.status(500).json({ error: 'Failed to start prompts generation' });
  }
});

// Keep other routes the same
router.get('/:id', async (req, res) => {
  try {
    const promptDoc = await Prompt.findById(req.params.id);
    
    if (!promptDoc) {
      return res.status(404).json({ error: 'Prompts not found' });
    }

    res.json(promptDoc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// Background task (keep this)
async function generatePrompts(promptId, topic, count) {
  try {
    const promptsData = await geminiService.generateAIPrompts(topic, count);
    const parsedData = JSON.parse(promptsData);

    const pdfUrl = await generatePromptsPdf(topic, parsedData.prompts, promptId);

    await Prompt.findByIdAndUpdate(promptId, {
      pdfUrl: pdfUrl,
      status: 'completed',
      prompts: [], // Clear the old prompts array
      totalPrompts: 0
    });

    console.log(`Prompts PDF ${promptId} generated successfully`);
  } catch (error) {
    console.error('Failed to generate prompts PDF:', error);
    await Prompt.findByIdAndUpdate(promptId, { status: 'failed' });
  }
}

export default router;