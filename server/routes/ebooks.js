import express from 'express';
import Ebook from '../models/Ebook.js';
import geminiService from '../services/geminiService.js';
import { protect } from '../middleware/authMiddleware.js';
import generatePdf from '../utils/pdfGenerator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper function to parse AI response
// Replace the parseAIResponse function with this improved version:
function parseAIResponse(content) {
  console.log('🔄 Starting to parse AI response...');
  console.log('   Raw content length:', content.length);
  
  // First, let's look for the JSON structure
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1) {
    console.log('❌ No JSON structure found');
    return createFallbackEbook();
  }
  
  let jsonStr = content.substring(jsonStart, jsonEnd + 1);
  console.log('   Extracted JSON length:', jsonStr.length);
  
  // Try to find and fix the specific issue - missing comma or bracket in chapters array
  const chaptersIndex = jsonStr.indexOf('"chapters": [');
  if (chaptersIndex === -1) {
    console.log('❌ No chapters array found in JSON');
    return createFallbackEbook();
  }
  
  // Let's manually extract and fix the chapters array
  let fixedJson = jsonStr;
  
  // Count opening and closing brackets for the chapters array
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;
  let chaptersEnd = -1;
  
  for (let i = chaptersIndex + 12; i < fixedJson.length; i++) {
    const char = fixedJson[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '[') {
        bracketCount++;
      } else if (char === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          chaptersEnd = i;
          break;
        }
      }
    }
  }
  
  if (chaptersEnd === -1) {
    // The chapters array is not properly closed - let's find where it should end
    console.log('⚠️  Chapters array not properly closed, attempting to fix...');
    
    // Look for the pattern: }, followed by whitespace, then either another { or ]
    let lastGoodPosition = chaptersIndex + 12;
    let chapterObjects = [];
    let currentPos = chaptersIndex + 12;
    
    // Try to find individual chapter objects
    while (currentPos < fixedJson.length) {
      const nextObjectStart = fixedJson.indexOf('{', currentPos);
      if (nextObjectStart === -1) break;
      
      let objectEnd = -1;
      let objBracketCount = 0;
      inString = false;
      escapeNext = false;
      
      for (let i = nextObjectStart; i < fixedJson.length; i++) {
        const char = fixedJson[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') {
            objBracketCount++;
          } else if (char === '}') {
            objBracketCount--;
            if (objBracketCount === 0) {
              objectEnd = i;
              break;
            }
          }
        }
      }
      
      if (objectEnd === -1) {
        // Couldn't find the end of this object
        break;
      }
      
      const chapterObject = fixedJson.substring(nextObjectStart, objectEnd + 1);
      chapterObjects.push(chapterObject);
      lastGoodPosition = objectEnd + 1;
      
      // Look for the next object or the end of the array
      const nextChar = fixedJson.substring(objectEnd + 1).match(/[^\s]/);
      if (!nextChar || nextChar[0] === ']') {
        break;
      }
      
      currentPos = objectEnd + 1;
    }
    
    if (chapterObjects.length > 0) {
      console.log(`✅ Found ${chapterObjects.length} chapter objects`);
      
      // Rebuild the chapters array
      const chaptersArray = '[' + chapterObjects.join(',') + ']';
      
      // Extract title and description
      const titleMatch = fixedJson.match(/"title"\s*:\s*"([^"]*)"/);
      const descMatch = fixedJson.match(/"description"\s*:\s*"([^"]*)"/);
      
      const title = titleMatch ? titleMatch[1] : "Digital Marketing Guide";
      const description = descMatch ? descMatch[1] : "A comprehensive digital marketing guide";
      
      // Create the fixed JSON
      fixedJson = `{
  "title": "${title}",
  "description": "${description}",
  "chapters": ${chaptersArray}
}`;
      
      console.log('✅ Rebuilt JSON with properly formatted chapters array');
    }
  }
  
  // Try to parse the fixed JSON
  try {
    const parsed = JSON.parse(fixedJson);
    console.log('✅ Successfully parsed fixed JSON');
    return validateEbookStructure(parsed);
  } catch (parseError) {
    console.log(`⚠️  Fixed parse failed: ${parseError.message}`);
    
    // Last resort: try to extract everything manually
    return extractCompleteEbookManually(jsonStr);
  }
}

// New function to extract complete ebook manually
function extractCompleteEbookManually(jsonStr) {
  console.log('🔍 Attempting complete manual extraction...');
  
  const result = {
    title: "Digital Marketing Mastery",
    description: "A comprehensive guide to digital marketing strategies",
    chapters: []
  };
  
  // Extract title
  const titleMatch = jsonStr.match(/"title"\s*:\s*"([^"]*)"/);
  if (titleMatch) {
    result.title = titleMatch[1];
  }
  
  // Extract description
  const descMatch = jsonStr.match(/"description"\s*:\s*"([^"]*)"/);
  if (descMatch) {
    result.description = descMatch[1];
  }
  
  // Find the chapters array content
  const chaptersMatch = jsonStr.match(/"chapters"\s*:\s*\[(.*)\]\s*,?\s*\}/s);
  if (chaptersMatch) {
    const chaptersContent = chaptersMatch[1];
    
    // Split by chapter objects - look for patterns like "title": "..."
    const chapterRegex = /\{[^{}]*?"title"\s*:\s*"[^"]*"[^{}]*?\}/g;
    const chapterMatches = chaptersContent.match(chapterRegex);
    
    if (chapterMatches && chapterMatches.length > 0) {
      chapterMatches.forEach((chapterStr, index) => {
        const chapter = extractChapterManually(chapterStr, index);
        result.chapters.push(chapter);
      });
      console.log(`✅ Extracted ${result.chapters.length} chapters manually`);
    } else {
      // Try alternative approach: split by }
      const chaptersByBrace = chaptersContent.split('}');
      let chapterIndex = 0;
      
      for (let i = 0; i < chaptersByBrace.length; i++) {
        const chapterContent = chaptersByBrace[i].trim();
        if (chapterContent && chapterContent.startsWith('{')) {
          const fullChapter = chapterContent + '}';
          const chapter = extractChapterManually(fullChapter, chapterIndex);
          if (chapter.title && chapter.content) {
            result.chapters.push(chapter);
            chapterIndex++;
          }
        }
      }
      
      console.log(`✅ Extracted ${result.chapters.length} chapters using brace splitting`);
    }
  }
  
  // If we still have no chapters, create some defaults
  if (result.chapters.length === 0) {
    console.log('⚠️  No chapters extracted, creating fallback chapters');
    result.chapters = createFallbackChapters();
  }
  
  return result;
}

// Helper function to extract a single chapter manually
function extractChapterManually(chapterStr, index) {
  const chapter = {
    title: `Chapter ${index + 1}`,
    content: "",
    subheadings: [],
    examples: [],
    keyTakeaways: []
  };
  
  // Extract title
  const titleMatch = chapterStr.match(/"title"\s*:\s*"([^"]*)"/);
  if (titleMatch) {
    chapter.title = titleMatch[1];
  }
  
  // Extract content (handle multiline content)
  const contentMatch = chapterStr.match(/"content"\s*:\s*"([\s\S]*?)"\s*,/);
  if (contentMatch) {
    chapter.content = contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  
  // Extract subheadings
  const subheadingsMatch = chapterStr.match(/"subheadings"\s*:\s*\[([\s\S]*?)\]/);
  if (subheadingsMatch) {
    try {
      const subheadingsStr = '[' + subheadingsMatch[1] + ']';
      chapter.subheadings = JSON.parse(subheadingsStr);
    } catch (e) {
      // If JSON parsing fails, extract manually
      const items = subheadingsMatch[1].split(',').map(item => {
        return item.trim().replace(/^"|"$/g, '');
      }).filter(item => item.length > 0);
      chapter.subheadings = items;
    }
  }
  
  // Extract examples
  const examplesMatch = chapterStr.match(/"examples"\s*:\s*\[([\s\S]*?)\]/);
  if (examplesMatch) {
    try {
      const examplesStr = '[' + examplesMatch[1] + ']';
      chapter.examples = JSON.parse(examplesStr);
    } catch (e) {
      const items = examplesMatch[1].split(',').map(item => {
        return item.trim().replace(/^"|"$/g, '');
      }).filter(item => item.length > 0);
      chapter.examples = items;
    }
  }
  
  // Extract key takeaways
  const takeawaysMatch = chapterStr.match(/"keyTakeaways"\s*:\s*\[([\s\S]*?)\]/);
  if (takeawaysMatch) {
    try {
      const takeawaysStr = '[' + takeawaysMatch[1] + ']';
      chapter.keyTakeaways = JSON.parse(takeawaysStr);
    } catch (e) {
      const items = takeawaysMatch[1].split(',').map(item => {
        return item.trim().replace(/^"|"$/g, '');
      }).filter(item => item.length > 0);
      chapter.keyTakeaways = items;
    }
  }
  
  // If no content was extracted, add some default content
  if (!chapter.content) {
    chapter.content = `This chapter covers important aspects of digital marketing. It provides valuable insights and practical advice that you can apply to your business. The content is designed to be actionable and results-oriented.`;
  }
  
  return chapter;
}

// Helper function to create fallback chapters
function createFallbackChapters() {
  return [
    {
      title: "Introduction to Digital Marketing",
      content: "Digital marketing has revolutionized how businesses connect with customers. This chapter covers the fundamentals of digital marketing and why it's essential for modern businesses.",
      subheadings: ["What is Digital Marketing?", "Key Benefits", "Digital vs Traditional Marketing"],
      examples: ["Nike's digital transformation", "Amazon's customer-centric approach"],
      keyTakeaways: ["Digital marketing is essential", "Focus on customer experience", "Measure and optimize"]
    },
    {
      title: "SEO Fundamentals",
      content: "Search Engine Optimization is crucial for online visibility. This chapter covers the basics of SEO and how to optimize your website for search engines.",
      subheadings: ["Keyword Research", "On-Page Optimization", "Link Building"],
      examples: ["Local SEO success story", "E-commerce SEO case study"],
      keyTakeaways: ["Quality content matters", "Technical SEO is important", "Build authoritative links"]
    },
    {
      title: "Social Media Marketing",
      content: "Social media platforms offer powerful tools for building brand awareness and engaging with customers. This chapter covers social media marketing strategies and best practices.",
      subheadings: ["Choosing Platforms", "Content Strategy", "Engagement Tactics"],
      examples: ["Instagram success stories", "Facebook advertising examples"],
      keyTakeaways: ["Be consistent", "Engage with your audience", "Use visual content"]
    },
    {
      title: "Email Marketing",
      content: "Email marketing remains one of the most effective digital marketing channels. This chapter covers email marketing strategies for nurturing leads and driving conversions.",
      subheadings: ["List Building", "Segmentation", "Automation"],
      examples: ["Welcome email sequences", "Abandoned cart recovery"],
      keyTakeaways: ["Personalize your emails", "Test and optimize", "Provide value"]
    }
  ];
}

// Helper function to extract and rebuild ebook from malformed JSON
function extractAndRebuildEbook(jsonStr) {
  console.log('🔍 Attempting to extract and rebuild ebook from malformed JSON...');
  
  const result = {
    title: "Ebook",
    description: "A comprehensive guide",
    chapters: []
  };
  
  try {
    // Extract title
    const titleMatch = jsonStr.match(/"title"\s*:\s*"([^"]*)"/);
    if (titleMatch) {
      result.title = titleMatch[1];
    }
    
    // Extract description
    const descMatch = jsonStr.match(/"description"\s*:\s*"([^"]*)"/);
    if (descMatch) {
      result.description = descMatch[1];
    }
    
    // Extract chapters array
    const chaptersMatch = jsonStr.match(/"chapters"\s*:\s*\[([\s\S]*?)\]\s*,?\s*\}/);
    if (chaptersMatch) {
      const chaptersContent = chaptersMatch[1];
      
      // Split chapters by finding each chapter object
      const chapterRegex = /\{[^{}]*"title"\s*:\s*"[^"]*"[^{}]*\}/g;
      const chapterMatches = chaptersContent.match(chapterRegex);
      
      if (chapterMatches && chapterMatches.length > 0) {
        chapterMatches.forEach((chapterStr, index) => {
          try {
            // Try to parse each chapter individually
            const chapter = JSON.parse(chapterStr);
            result.chapters.push(chapter);
          } catch (chapterError) {
            // If parsing fails, extract fields manually
            const chapterTitle = chapterStr.match(/"title"\s*:\s*"([^"]*)"/);
            const content = chapterStr.match(/"content"\s*:\s*"([^"]*)"/);
            const subheadings = chapterStr.match(/"subheadings"\s*:\s*\[([^\]]*)\]/);
            const examples = chapterStr.match(/"examples"\s*:\s*\[([^\]]*)\]/);
            const takeaways = chapterStr.match(/"keyTakeaways"\s*:\s*\[([^\]]*)\]/);
            
            const chapter = {
              title: chapterTitle ? chapterTitle[1] : `Chapter ${index + 1}`,
              content: content ? content[1] : "Chapter content...",
              subheadings: subheadings ? 
                parseSimpleArray(subheadings[1]) : ["Section 1", "Section 2"],
              examples: examples ? 
                parseSimpleArray(examples[1]) : ["Example 1", "Example 2"],
              keyTakeaways: takeaways ? 
                parseSimpleArray(takeaways[1]) : ["Takeaway 1", "Takeaway 2"]
            };
            
            result.chapters.push(chapter);
          }
        });
      }
    }
    
    console.log(`✅ Extracted ${result.chapters.length} chapters`);
    return result;
    
  } catch (error) {
    console.error('❌ Failed to extract and rebuild:', error.message);
    return createFallbackEbook();
  }
}

// Helper function to parse simple array strings
function parseSimpleArray(arrayStr) {
  try {
    // Remove quotes and split by comma
    const items = arrayStr.split(',').map(item => {
      let cleaned = item.trim();
      // Remove surrounding quotes if present
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1);
      }
      return cleaned;
    });
    return items.filter(item => item.length > 0);
  } catch (error) {
    return ["Item 1", "Item 2", "Item 3"];
  }
}

// Helper function to validate and fix ebook structure
function validateEbookStructure(parsedData) {
  const result = {
    title: parsedData.title || "Digital Marketing Guide",
    description: parsedData.description || "A comprehensive guide to digital marketing",
    chapters: []
  };
  
  if (parsedData.chapters && Array.isArray(parsedData.chapters)) {
    result.chapters = parsedData.chapters.map((chapter, index) => ({
      title: chapter.title || `Chapter ${index + 1}: Digital Marketing Topic`,
      content: chapter.content || `This chapter provides valuable insights into digital marketing. It covers important concepts and practical applications that you can use to improve your marketing efforts.`,
      subheadings: Array.isArray(chapter.subheadings) && chapter.subheadings.length > 0 ? 
        chapter.subheadings : ["Key Concepts", "Practical Applications", "Best Practices"],
      examples: Array.isArray(chapter.examples) && chapter.examples.length > 0 ? 
        chapter.examples : ["Real-world example 1", "Case study 2", "Practical scenario 3"],
      keyTakeaways: Array.isArray(chapter.keyTakeaways) && chapter.keyTakeaways.length > 0 ? 
        chapter.keyTakeaways : ["Important insight 1", "Key learning 2", "Actionable tip 3"]
    }));
  } else {
    // If no chapters in parsed data, use fallback chapters
    result.chapters = createFallbackChapters();
  }
  
  console.log(`✅ Validated structure with ${result.chapters.length} chapters`);
  return result;
}
// Create fallback ebook structure
function createFallbackEbook() {
  console.log('🔄 Creating fallback ebook structure');
  
  return {
    title: "Comprehensive Ebook",
    description: "A detailed guide with practical insights",
    chapters: [
      {
        title: "Introduction",
        content: "This ebook provides comprehensive coverage of the topic with detailed explanations and practical examples. The content is designed to be actionable and valuable for readers at all levels.",
        subheadings: ["Getting Started", "Core Concepts", "Practical Applications"],
        examples: ["Real-world scenario", "Step-by-step implementation", "Case study analysis"],
        keyTakeaways: ["Understand the fundamentals", "Learn practical applications", "Apply knowledge immediately"]
      },
      {
        title: "Advanced Topics",
        content: "This chapter explores more advanced concepts and applications, providing deeper insights and specialized knowledge. You'll learn sophisticated techniques and strategies to enhance your skills.",
        subheadings: ["Advanced Techniques", "Best Practices", "Optimization Strategies"],
        examples: ["Complex implementation", "Advanced case study", "Performance optimization"],
        keyTakeaways: ["Master advanced concepts", "Implement best practices", "Optimize for results"]
      }
    ]
  };
}

function sanitizeEbookContent(ebookData) {
  console.log('✨ Sanitizing ebook content...');
  if (!ebookData || !ebookData.chapters) {
    console.log('⚠️ ebookData or ebookData.chapters is null/undefined.');
    return ebookData;
  }

  if (!Array.isArray(ebookData.chapters)) {
    console.log('⚠️ ebookData.chapters is not an array, type:', typeof ebookData.chapters);
    // Attempt to convert to array if it's a single object (unlikely but defensive)
    if (typeof ebookData.chapters === 'object' && ebookData.chapters !== null) {
      ebookData.chapters = [ebookData.chapters];
      console.log('   Converted non-array chapters to array of one element.');
    } else {
      return ebookData; // Cannot sanitize if not an array or object
    }
  }

  ebookData.chapters.forEach((chapter, index) => {
    console.log(`--- Chapter ${index} inspection ---`);
    console.log(`Type of chapter: ${typeof chapter}`);
    if (typeof chapter !== 'object' || chapter === null) {
      console.log(`⚠️ Chapter ${index} is not an object, skipping sanitation for this chapter.`);
      return; // Skip if it's not a valid object
    }

    // 1. Sanitize chapter title - remove trailing page numbers
    if (chapter.title) {
      console.log(`  Original title: "${chapter.title}"`);
      chapter.title = chapter.title.replace(/\s+\d+$/, '').trim();
      console.log(`  Sanitized title: "${chapter.title}"`);
    } else {
      console.log('  Chapter title is missing.');
      chapter.title = `Untitled Chapter ${index + 1}`; // Provide a fallback title
    }
    console.log(`  Type of chapter.title: ${typeof chapter.title}`);


    // 2. Sanitize chapter content
    if (chapter.content) {
      console.log(`  Original content length: ${chapter.content.length}`);
      // Remove ToC-like entries from content
      chapter.content = chapter.content.replace(/Chapter \d+:?.*?\d+\s*$/gm, '');
      
      // Remove leading asterisks from list items
      chapter.content = chapter.content.replace(/^\s*\*\s+/gm, '');

      // Remove double asterisks (bold markdown)
      chapter.content = chapter.content.replace(/\*\*(.*?)\*\*/g, '$1'); // <-- NEW LINE

      // Clean up extra newlines that might result from replacements
      chapter.content = chapter.content.replace(/\n\n+/g, '\n\n').trim();
      console.log(`  Sanitized content length: ${chapter.content.length}`);
    } else {
      console.log('  Chapter content is missing.');
      chapter.content = `Content for chapter ${index + 1} is being generated.`; // Provide fallback content
    }
    console.log(`  Type of chapter.content: ${typeof chapter.content}`);

    // Validate and fix subheadings, examples, keyTakeaways
    ['subheadings', 'examples', 'keyTakeaways'].forEach(field => {
      if (!Array.isArray(chapter[field])) {
        console.log(`  ⚠️ Chapter ${index}.${field} is not an array. Type: ${typeof chapter[field]}. Converting to empty array.`);
        chapter[field] = [];
      } else if (!chapter[field].every(item => typeof item === 'string')) {
        console.log(`  ⚠️ Chapter ${index}.${field} contains non-string elements. Filtering.`);
        chapter[field] = chapter[field].filter(item => typeof item === 'string');
      }
      console.log(`  Type of chapter.${field}: Array<String> (verified)`);
    });
  });

  console.log('✅ Ebook content sanitized.');
  return ebookData;
}

// Background task to generate ebook content
async function generateEbookContent(ebookId, topic, chapters, numberOfChapters) {
  try {
    console.log(`📚 Starting ebook generation for: "${topic}"`);
    console.log(`   Target chapters: ${numberOfChapters}`);
    console.log(`   Chapters requested: ${chapters.length > 0 ? chapters.join(', ') : 'auto-generated'}`);

    const chaptersToGenerate = numberOfChapters;
    const batchSize = 5; // Generate 5 chapters per batch
    const numBatches = Math.ceil(chaptersToGenerate / batchSize);
    
    let allChapters = [];

    // Update the ebook with totalBatches at the start
    await Ebook.findByIdAndUpdate(ebookId, { 
      'progress.totalBatches': numBatches,
      status: 'generating'
    });

    for (let i = 0; i < numBatches; i++) {
        const chaptersInBatch = Math.min(batchSize, chaptersToGenerate - allChapters.length);
        if (chaptersInBatch <= 0) continue;

        console.log(`🔄 Generating batch ${i + 1}/${numBatches} for ${chaptersInBatch} chapters...`);

        const existingTitles = allChapters.map(c => `"${c.title}"`).join(", ");
        const prompt = `
Topic: "${topic}"
Existing Chapter Titles: [${existingTitles}]

Generate the next ${chaptersInBatch} chapters for this ebook.

    **RULES:**
    - Output ONLY a valid JSON object.
    - The JSON object must have a single key: "chapters".
    - "chapters" is an array of chapter objects.
    - Each chapter object must have keys: "title", "content", "subheadings", "examples", "keyTakeaways".
    - DO NOT number the "title" string.
    - Chapter "title" must be concise (under 10 words), descriptive, and accurately reflect the chapter's content. Avoid questions or overly long phrases in titles.
    - "content" must be 800-1200 words of detailed, expert-level content.

    JSON OUPUT:`;

        const content = await geminiService.generateContent(prompt);
        
        try {
            let parsed = JSON.parse(content);
            if (parsed.chapters && Array.isArray(parsed.chapters)) {
                allChapters.push(...parsed.chapters);
            }
        } catch (e) {
            console.warn(`⚠️ Batch ${i+1} failed to parse, attempting recovery.`);
            const recovered = parseAIResponse(content);
            if(recovered.chapters && recovered.chapters.length > 0){
                allChapters.push(...recovered.chapters);
            }
        }
        
        // Update progress after each batch with dynamic message
        await Ebook.findByIdAndUpdate(ebookId, {
            'progress.currentBatch': i + 1,
            'progress.chaptersGenerated': allChapters.length,
            status: 'generating', // Keep status as generating until completed
            message: `🔄 Generating batch ${i + 1}/${numBatches} for ${chaptersInBatch} chapters...`
        });
        console.log(`✅ Batch ${i + 1} successful. Total chapters: ${allChapters.length}`);
    }

    if (allChapters.length === 0) {
      throw new Error('No chapters were generated after all batches.');
    }

    const titlePrompt = `Generate a SEO-friendly title and a compelling description for an ebook about "${topic}" with chapters on: ${allChapters.map(c => `"${c.title}"`).join(", ")}. Respond with a JSON object containing "title" and "description".`;
    const titleContent = await geminiService.generateContent(titlePrompt);
    let ebookDetails = { title: `Guide to ${topic}`, description: `An ebook about ${topic}` };
    try {
        ebookDetails = JSON.parse(titleContent);
    } catch(e) {
        console.error("Could not parse title/description JSON.");
    }
    
    const ebookData = {
        title: ebookDetails.title,
        description: ebookDetails.description,
        chapters: allChapters
    };

    const sanitizedEbookData = sanitizeEbookContent(ebookData);

    // Calculate word count
    const wordCount = sanitizedEbookData.chapters.reduce((total, chapter) => {
      const chapterContent = chapter.content || '';
      return total + chapterContent.split(' ').length;
    }, 0);
    
    console.log(`   Total word count: ~${wordCount}`);
    console.log(`   Chapter count: ${sanitizedEbookData.chapters.length}`);

    // Update ebook with generated content
    await Ebook.findByIdAndUpdate(ebookId, {
      title: sanitizedEbookData.title || `Complete Guide to ${topic}`,
      description: sanitizedEbookData.description || `A comprehensive ${numberOfChapters}-chapter ebook about ${topic}`,
      chapters: sanitizedEbookData.chapters,
      wordCount: wordCount,
      status: 'completed',
      'progress.currentBatch': numBatches, // Finalize progress
      'progress.chaptersGenerated': allChapters.length
    });

    // Generate PDF
    const ebook = await Ebook.findById(ebookId);
    const pdfUrl = await generatePdf(ebook, ebookId);
    
    await Ebook.findByIdAndUpdate(ebookId, { pdfUrl });

    console.log(`✅ Ebook ${ebookId} generated successfully with PDF`);
  } catch (error) {
    console.error('❌ Failed to generate ebook content:', error.message);
    console.error('   Stack trace:', error.stack);
    
    await Ebook.findByIdAndUpdate(ebookId, { 
      status: 'failed',
      error: error.message,
      'progress.currentBatch': 0, // Reset progress on failure
      'progress.chaptersGenerated': 0,
      'progress.totalBatches': 0
    });
  }
}

// Generate new ebook
router.post('/generate', protect, async (req, res) => {
  try {
    let { topic, chapters = [], numberOfChapters = 10 } = req.body;
    const userId = req.user._id;

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    // Enforce chapter limits
    const minChapters = 2;
    const maxChapters = 20;
    numberOfChapters = Math.max(minChapters, Math.min(maxChapters, numberOfChapters));

    // Create ebook record
    const ebook = new Ebook({
      topic: topic.trim(),
      title: `Ebook about ${topic}`,
      description: 'Generating...',
      status: 'generating',
      user: userId,
      message: 'Ebook generation started! Processing chapters in batches...', // Initial descriptive message
      progress: {
        currentBatch: 0,
        totalBatches: 0,
        chaptersGenerated: 0
      }
    });

    await ebook.save();

    // Generate content (in background)
    generateEbookContent(ebook._id, topic, chapters, numberOfChapters);

    res.json({
      message: ebook.message, // Return the initial descriptive message
      ebookId: ebook._id,
      status: 'generating',
      numberOfChapters: numberOfChapters // Include numberOfChapters in the response
    });

  } catch (error) {
    console.error('Ebook generation error:', error);
    res.status(500).json({ 
      error: 'Failed to start ebook generation',
      details: error.message 
    });
  }
});

// Get ebook by ID
router.get('/:id', async (req, res) => {
  try {
    const ebook = await Ebook.findById(req.params.id);
    
    if (!ebook) {
      return res.status(404).json({ error: 'Ebook not found' });
    }
    console.log('Server sending ebook status:', ebook.status, 'message:', ebook.message); // Debugging line
    res.json(ebook);
  } catch (error) {
    console.error('Failed to fetch ebook:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ebook',
      details: error.message 
    });
  }
});

// Download ebook PDF
router.get('/:id/download', async (req, res) => {
  try {
    const ebook = await Ebook.findById(req.params.id);
    
    if (!ebook) {
      return res.status(404).json({ error: 'Ebook not found' });
    }

    if (!ebook.pdfUrl) {
      return res.status(404).json({ error: 'PDF not available for this ebook' });
    }

    const filePath = path.join(__dirname, '..', 'public', ebook.pdfUrl);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${ebook.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: 'Failed to download ebook',
      details: error.message 
    });
  }
});

// Get all ebooks for user
router.get('/', protect, async (req, res) => {
  try {
    const ebooks = await Ebook.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(ebooks);
  } catch (error) {
    console.error('Failed to fetch ebooks:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ebooks',
      details: error.message 
    });
  }
});

export default router;