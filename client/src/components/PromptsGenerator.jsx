import { useState } from 'react';
import { motion } from 'framer-motion';
import { promptsAPI } from '../services/api';

const PromptsGenerator = () => {
  const [formData, setFormData] = useState({
    topic: '',
    count: 100
  });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false); // New state for download loading
  const [result, setResult] = useState(null);

  const handleDownloadPdf = async (pdfUrl, promptId) => {
    setDownloading(true);
    try {
      // Assuming the full URL is needed for fetching
      const fullPdfUrl = `${import.meta.env.VITE_REACT_APP_BACKEND_BASEURL}${pdfUrl}`;
      const response = await fetch(fullPdfUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ai_prompts_${promptId}.pdf`); // Set a default filename
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // Optionally, show a user-friendly error message
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await promptsAPI.generate({
        topic: formData.topic,
        count: formData.count
      });

      setResult({
        status: 'generating',
        promptId: response.data.promptId,
        message: 'AI prompts generation started! It may take a few minutes.'
      });

      // Poll for completion
      checkPromptsStatus(response.data.promptId);
    } catch (error) {
      console.error('Error generating prompts:', error);
      setResult({
        status: 'error',
        message: 'Failed to generate prompts. Please try again.'
      });
      setLoading(false);
    }
  };

  const checkPromptsStatus = async (promptId) => {
    try {
      const response = await promptsAPI.getStatus(promptId);
      const promptData = response.data;

      if (promptData.status === 'completed') {
        setResult({
          status: 'completed',
          prompts: promptData,
          message: `Successfully generated 100 AI prompts!`
        });
      } else if (promptData.status === 'failed') {
        setResult({
          status: 'error',
          message: 'Prompts generation failed. Please try again.'
        });
      } else {
        // Still generating, check again in 5 seconds
        setTimeout(() => checkPromptsStatus(promptId), 5000);
        return;
      }
    } catch (error) {
      console.error('Error checking prompts status:', error);
      setResult({
        status: 'error',
        message: 'Error checking generation status.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto"
    >
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          AI Prompts PDF Generator
        </h2>
        <p className="text-sm sm:text-base text-gray-600 mb-6">
          Generate a PDF with 100 AI prompts for any topic.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Topic Input */}
          <div>
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
              Topic / Niche *
            </label>
            <input
              type="text"
              required
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="e.g., Digital Marketing, Creative Writing, Image Generation, Productivity"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
            />
          </div>

          {/* Prompt Count */}
          <div>
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
              Number of Prompts
            </label>
            <input
              type="number"
              required
              min="1"
              max="100"
              value={formData.count}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setFormData({
                  ...formData,
                  count: Math.max(1, Math.min(100, isNaN(value) ? 1 : value))
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
            />
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className={`w-full py-2.5 px-4 rounded-lg font-semibold text-white text-base sm:text-lg ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-purple-500 hover:bg-purple-600'
            } transition duration-200`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Generating Prompts...
              </div>
            ) : (
              'Generate AI Prompts'
            )}
          </motion.button>
        </form>

        {/* Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 p-3 rounded-lg text-sm sm:text-base ${
              result.status === 'error' 
                ? 'bg-red-50 border border-red-200 text-red-700'
                : result.status === 'completed'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-purple-50 border border-purple-200 text-purple-700'
            }`}
          >
            <div className="flex items-center">
              {result.status === 'generating' && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 mr-3"></div>
              )}
              {result.status === 'completed' && (
                <div className="text-green-500 mr-3">✓</div>
              )}
              {result.status === 'error' && (
                <div className="text-red-500 mr-3">✗</div>
              )}
              <p>{result.message}</p>
            </div>

            {result.status === 'completed' && result.prompts && result.prompts.pdfUrl && (
              <div className="mt-4 p-4 bg-white rounded border">
                <button
                  onClick={() => handleDownloadPdf(result.prompts.pdfUrl, result.prompts.promptId)}
                  disabled={downloading}
                  className="bg-purple-500 text-white px-3 py-1.5 rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {downloading ? 'Downloading...' : 'Download PDF'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default PromptsGenerator;