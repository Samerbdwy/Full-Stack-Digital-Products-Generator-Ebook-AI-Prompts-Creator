import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🚨 CRITICAL FIX: Load environment variables FIRST
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Debug environment variables IMMEDIATELY after loading
console.log('\n🔍 Environment Variables Check (BEFORE imports):');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? `✓ Found (ends with ...${process.env.GEMINI_API_KEY.slice(-4)})` : '✗ Missing');

// NOW import routes and services (they will have access to env vars)
import ebookRoutes from './routes/ebooks.js';
import promptRoutes from './routes/prompts.js';

import authRoutes from './routes/auth.js';
import geminiService from './services/geminiService.js'; // ✅ Import the INSTANCE, not the class

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CRITICAL: Initialize Gemini Service AFTER environment variables are loaded
console.log('🔧 Initializing Gemini Service...');
const geminiInitialized = geminiService.initialize();
console.log('🔧 Gemini Service initialization result:', geminiInitialized);

// Debug: Check what we imported
console.log('🔍 Imported geminiService type:', typeof geminiService);
console.log('🔍 geminiService methods:', Object.keys(geminiService).filter(key => typeof geminiService[key] === 'function'));

// Debug environment variables again after imports
console.log('🔍 Environment Variables Check (AFTER imports):');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? `✓ Found (ends with ...${process.env.GEMINI_API_KEY.slice(-4)})` : '✗ Missing');
console.log('');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/prompts', express.static(path.join(__dirname, 'public/prompts')));


// Use routes
app.use('/api/users', authRoutes);
app.use('/api/ebooks', ebookRoutes);
app.use('/api/prompts', promptRoutes);


// Simple Gemini API test using the imported service instance
const testGeminiAPI = async () => {
  console.log('🧪 Testing Gemini API connection...');
  try {
    const testPrompt = "Hello! Please respond with just 'API Test Successful'";
    const response = await geminiService.generateContent(testPrompt);
    
    if (response && response.includes('API Test Successful')) {
      console.log('✅ Gemini API: Connected and working!');
    } else if (response) {
      console.log('🔄 Gemini API: Using mock data (API not configured properly)');
    } else {
      console.log('❌ Gemini API: No response received');
    }
  } catch (error) {
    console.log('❌ Gemini API: Test failed -', error.message);
  }
  console.log('');
};

// Basic route for testing with system status
app.get('/api/health', (req, res) => {
  const systemStatus = {
    server: 'running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    gemini_api: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
    gemini_status: geminiService.initialized ? 'ready' : 'mock_mode',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };
  
  res.json({ 
    message: 'Digital Product Generator API is running!',
    status: systemStatus
  });
});

// Enhanced root endpoint with API documentation
app.get('/api', (req, res) => {
  res.json({
    message: 'Digital Product Generator API',
    endpoints: {
      auth: {
        'POST /api/users/register': 'Register new user',
        'POST /api/users/login': 'User login'
      },
      ebooks: {
        'POST /api/ebooks/generate': 'Generate new ebook',
        'GET /api/ebooks/:id': 'Get ebook status/content'
      },
      prompts: {
        'POST /api/prompts/generate': 'Generate AI prompts', 
        'GET /api/prompts/:id': 'Get prompts status/content'
      },

      system: {
        'GET /api/health': 'System health check'
      }
    },
    status: {
      server: `Running on port ${PORT}`,
      environment: process.env.NODE_ENV || 'development',
      gemini_api: geminiService.initialized ? 'active' : 'mock_mode'
    }
  });
});

// Demo endpoint to test Gemini API directly
app.get('/api/test-gemini', async (req, res) => {
  try {
    const testPrompt = "Write a short test message confirming the Gemini API is working properly.";
    const response = await geminiService.generateContent(testPrompt);
    
    res.json({
      success: true,
      gemini_initialized: geminiService.initialized,
      response: response,
      used_mock_data: !geminiService.initialized
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler - MUST be after all other routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/test-gemini',
      'POST /api/users/register',
      'POST /api/users/login', 
      'POST /api/ebooks/generate',
      'POST /api/prompts/generate',

    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err.stack);
  
  // MongoDB errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(503).json({
      error: 'Database Error',
      message: 'Service temporarily unavailable'
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token'
    });
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }
  
  // Gemini API errors
  if (err.message.includes('Gemini') || err.message.includes('API')) {
    return res.status(502).json({
      error: 'AI Service Error',
      message: 'AI service temporarily unavailable'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message
  });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/digital-product-generator');
    console.log('✅ MongoDB connected successfully');
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   Host: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('💡 Please check your MONGODB_URI in .env file');
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Received shutdown signal...');
  console.log('Closing MongoDB connection...');
  
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const startServer = async () => {
  console.log('🚀 Starting Digital Product Generator Server...\n');
  
  // Connect to database first
  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.log('❌ Failed to connect to database. Server cannot start.');
    return;
  }
  
  // Test Gemini API
  await testGeminiAPI();
  
  // Start listening
  app.listen(PORT, () => {
    console.log('🌈 Server Status:');
    console.log(`   ✅ Server running on port ${PORT}`);
    console.log(`   ✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   ✅ MongoDB: Connected`);
    console.log(`   ✅ Gemini API: ${geminiService.initialized ? 'Ready' : 'Mock Mode'}`);
    console.log(`   ✅ Health check: http://localhost:${PORT}/api/health`);
    console.log(`   ✅ API test: http://localhost:${PORT}/api/test-gemini`);
    console.log(`   ✅ API docs: http://localhost:${PORT}/api`);
    
    if (!geminiService.initialized) {
      console.log('\n⚠️  Gemini API is in MOCK MODE');
      console.log('💡 To enable real AI generation:');
      console.log('   1. Check your GEMINI_API_KEY in .env file');
      console.log('   2. Ensure the API key is valid in Google AI Studio');
      console.log('   3. Restart the server');
    } else {
      console.log('\n🎯 Ready to generate digital products with AI!');
    }
  });
};

// Initialize server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
