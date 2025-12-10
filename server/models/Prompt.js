import mongoose from 'mongoose';

const promptSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  topic: {
    type: String,
    required: true
  },
  prompts: [{
    title: String,
    prompt: String,
    category: String,
    useCase: String
  }],
  totalPrompts: {
    type: Number,
    default: 0
  },
  pdfUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'generating'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Prompt', promptSchema);