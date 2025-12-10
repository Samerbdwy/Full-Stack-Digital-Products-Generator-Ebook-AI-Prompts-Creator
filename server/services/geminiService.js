import OpenAI from "openai";

class GeminiService {
  constructor() {
    this.openaiClient = null;
    this.initialized = false;
  }

  initialize() {
    try {
      console.log('🔑 Initializing Gemini Service...');
      
      if (!process.env.GEMINI_API_KEY) {
        console.log('❌ GEMINI_API_KEY not found during initialization');
        return false;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey.includes('your_actual_gemini_api_key') || apiKey.length < 10) {
        console.log('❌ Please replace the placeholder API key with your actual Gemini API key');
        return false;
      }

      console.log('🔑 Creating OpenAI client for Gemini...');
      
      this.openaiClient = new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      });
      
      this.initialized = true;
      console.log(`✅ Gemini AI initialized successfully`);
      console.log(`   API Key ends with: ...${process.env.GEMINI_API_KEY.slice(-4)}`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Gemini client:', error.message);
      this.initialized = false;
      return false;
    }
  }

  async generateContent(prompt, retries = 2) {
    try {
      console.log('\n🔧 Gemini Service - generateContent called');
      console.log('   Prompt length:', prompt.length);
      console.log('   Client initialized:', this.initialized);
      console.log('   Retries remaining:', retries);
      
      if (!this.initialized || !this.openaiClient) {
        console.log('🔄 OpenAI client not available, using mock data...');
        return await this.generateMockContent(prompt);
      }

      console.log('   Making API call to Gemini...');
      
      const response = await this.openaiClient.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 65536, // Increased for longer content
        temperature: 0.7,
      });

      if (response.choices && response.choices.length > 0 && response.choices[0].message && response.choices[0].message.content) {
        console.log('✅ Gemini API call successful');
        console.log('   Response length:', response.choices[0].message.content.length);
        return response.choices[0].message.content;
      } else {
        throw new Error('Unexpected API response format');
      }
      
    } catch (error) {
      console.error('❌ Gemini API call failed:', error.message);
      if (retries > 0) {
        console.log(`🔄 Retrying... (${retries} attempts left)`);
        return await this.generateContent(prompt, retries - 1);
      }
      console.log('🔄 Falling back to mock data...');
      return await this.generateMockContent(prompt);
    }
  }

  async generateMockContent(prompt) {
    console.log('🎭 Generating mock content...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (prompt.includes('ebook')) {
      const topic = this.extractTopicFromPrompt(prompt) || 'the topic';
      const mockData = {
        title: `The Complete Guide to ${topic}`,
        description: `A comprehensive guide to mastering ${topic}. Perfect for beginners and experts alike.`,
        chapters: [
          {
            title: `Introduction to ${topic}`,
            content: `Welcome to the world of ${topic}! This guide will help you understand the fundamentals and advanced concepts. ${topic} is an essential skill in today's world, and this ebook will provide you with practical knowledge you can apply immediately.\n\nIn this comprehensive guide, we'll cover everything from basic principles to advanced strategies. Whether you're just starting out or looking to enhance your existing knowledge, this ebook has something valuable for you.\n\nWe'll explore real-world applications, common challenges, and proven solutions that you can implement right away. Each chapter is designed to build upon the previous one, creating a solid foundation of understanding.`,
            subheadings: ["Getting Started", "Core Concepts", "Practical Applications"],
            examples: [
              "A real-world scenario showing how to apply these concepts",
              "Step-by-step guide for implementing the strategies",
              "Case study demonstrating successful implementation"
            ],
            keyTakeaways: [
              "Understand the fundamental principles of " + topic,
              "Learn practical strategies you can implement immediately", 
              "Gain confidence in applying these concepts in real situations"
            ]
          },
          {
            title: `Advanced ${topic} Strategies`,
            content: `Now that you understand the basics, let's dive into more advanced strategies for mastering ${topic}. This chapter will explore sophisticated techniques and approaches that can take your skills to the next level.\n\nWe'll examine complex scenarios and provide detailed solutions for each. You'll learn how to analyze situations, make informed decisions, and implement effective strategies that deliver results.\n\nAdvanced ${topic} requires a deeper understanding of the underlying principles and the ability to adapt to changing circumstances. This chapter will equip you with the knowledge and tools needed to excel in any situation.`,
            subheadings: ["Advanced Techniques", "Problem Solving", "Optimization"],
            examples: [
              "Complex problem-solving scenario with detailed analysis",
              "Optimization techniques for maximum efficiency",
              "Advanced implementation strategies"
            ],
            keyTakeaways: [
              "Master advanced techniques and strategies",
              "Develop problem-solving skills for complex situations",
              "Learn optimization methods for better results"
            ]
          }
        ]
      };
      console.log('   Mock ebook data generated');
      return JSON.stringify(mockData);
    } else {
      const topic = this.extractTopicFromPrompt(prompt) || 'the subject';
      const mockData = {
        prompts: [
          {
            title: `${topic} Content Creation`,
            prompt: `Create engaging content about ${topic}`,
            category: "Content Writing",
            useCase: "ChatGPT"
          }
        ]
      };
      console.log('   Mock prompts data generated');
      return JSON.stringify(mockData);
    }
  }

  extractTopicFromPrompt(prompt) {
    const topicMatch = prompt.match(/"([^"]+)"/) || prompt.match(/about\s+([^.\n]+)/) || prompt.match(/topic[:\s]+([^.\n]+)/i);
    return topicMatch ? topicMatch[1].trim() : null;
  }

  async generateAIPrompts(topic, count = 100) {
    console.log(`\n🤖 Generating ${count} AI prompts for: "${topic}"`);
    
    const prompt = `
    You are an expert prompt generator.
    Your task is to generate ${count} diverse and high-quality AI prompts about the topic: "${topic}".

    The prompts should be in the style of the following examples:
    - "Create a viral Instagram Reel script teaching how to grow a faceless page from scratch. Include hook + steps + CTA."
    - "Explain why faceless pages grow faster. Give 5 psychological reasons."
    - "Turn this into a high-retention carousel for Instagram: {insert topic}."
    - "List 10 content ideas for a faceless page in the {insert niche} niche that can grow to 10k followers fast."
    - "Break down the algorithm strategy for faceless theme pages growing from 0 to 50k."

    **RULES:**
    - Output ONLY a valid JSON object.
    - The JSON object must have a single key: "prompts".
    - "prompts" must be an array of ${count} strings.
    - Each string in the array is a unique and creative prompt.
    - Do not number the prompts in the output.

    **JSON OUTPUT EXAMPLE:**
    {
      "prompts": [
        "Prompt 1...",
        "Prompt 2...",
        "..."
      ]
    }
    `;

    try {
      let content = await this.generateContent(prompt);
      
      // Clean the response
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        content = content.substring(jsonStart, jsonEnd + 1);
      }
      
      console.log('✅ AI prompts generated successfully');
      return content;
    } catch (error) {
      console.error('❌ Failed to generate AI prompts:', error.message);
      throw error;
    }
  }
}

const geminiService = new GeminiService();
export default geminiService;