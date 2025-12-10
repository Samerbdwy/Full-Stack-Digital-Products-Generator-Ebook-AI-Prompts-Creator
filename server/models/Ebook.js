import mongoose from 'mongoose';

const ebookSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  title: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  chapters: [{
    title: String,
    content: String,
    subheadings: [String],
    examples: [String],
    keyTakeaways: [String]
  }],
  thumbnail: {
    type: String // URL or base64
  },
  banner: {
    type: String // URL or base64
  },
  pdfUrl: {
    type: String
  },
  wordCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'generating'
  },
  message: { // Add this field to store dynamic progress messages
    type: String
  },
  progress: {
    currentBatch: { type: Number, default: 0 },
    totalBatches: { type: Number, default: 0 },
    chaptersGenerated: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Ebook', ebookSchema);