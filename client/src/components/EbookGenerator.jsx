import { useState } from 'react';
import { motion } from 'framer-motion';
import { ebookAPI } from '../services/api';
import authService from '../services/authService';

const EbookGenerator = () => {
  const [formData, setFormData] = useState({
    topic: '',
    numberOfChapters: 10 // Default to 10 chapters
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [generationProgress, setGenerationProgress] = useState(null);

  // Helper function to get the most relevant message
  const getProgressMessage = () => {
    if (generationProgress) {
      if (typeof generationProgress === 'string') {
        return generationProgress;
      }
      if (typeof generationProgress === 'object' && generationProgress.message) {
        return generationProgress.message;
      }
      // If it's an object but without a message property, or some other non-displayable truthy value
      // Fallback to result?.message
      return result?.message || 'Generating Ebook...';
    }
    return result?.message || 'Generating Ebook...';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setGenerationProgress(null); // Clear previous progress

    // Check if user is authenticated
    const user = authService.getCurrentUser();
    if (!user) {
      setResult({
        status: 'error',
        message: 'Please login to generate ebooks'
      });
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 Starting ebook generation...');
      console.log('🔐 Current user:', user);
      
      const chaptersArray = [];

      const response = await ebookAPI.generate({
        topic: formData.topic,
        chapters: chaptersArray, // User-provided chapter titles
        numberOfChapters: formData.numberOfChapters // Number of chapters to generate
      });

      console.log('✅ Generation started:', response.data);

      setResult({
        status: 'generating',
        ebookId: response.data.ebookId,
        message: response.data.message || 'Ebook generation started! It may take a few minutes.', // Use backend message
        numberOfChapters: response.data.numberOfChapters // Capture validated number of chapters
      });

      // Poll for completion
      checkEbookStatus(response.data.ebookId);
    } catch (error) {
      console.error('❌ Error generating ebook:', error);
      
      let errorMessage = 'Failed to generate ebook. Please try again.';
      
      if (error.response?.status === 403) {
        errorMessage = 'Authentication failed. Please login again.';
        authService.logout();
      } else if (error.response?.status === 402) {
        errorMessage = 'Not enough credits. Please purchase more credits.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setResult({
        status: 'error',
        message: errorMessage
      });
      setLoading(false);
    }
  };

  // Rest of your component code remains the same...
  const checkEbookStatus = async (ebookId) => {
    try {
      const response = await ebookAPI.getStatus(ebookId);
      const ebook = response.data;

      if (ebook.status === 'completed') {
        setResult({
          status: 'completed',
          ebook: ebook,
          message: 'Ebook generated successfully!'
        });
        setGenerationProgress(null); // Clear progress on completion
      } else if (ebook.status === 'failed') {
        setResult({
          status: 'error',
          message: ebook.error || 'Ebook generation failed. Please try again.'
        });
        setGenerationProgress(null); // Clear progress on failure
      } else if (ebook.status === 'generating') {
        // Log the message to the browser console
        console.log('Ebook generation progress:', ebook.message);
        // Update progress
        if (ebook.progress) {
          setGenerationProgress(ebook.progress);
        }
        setResult(prevResult => ({
          ...prevResult,
          status: 'generating',
          message: ebook.message || 'Generating Ebook...' // Use the dynamic message from the backend
        }));
        // Still generating, check again in 5 seconds
        setTimeout(() => checkEbookStatus(ebookId), 5000);
        return;
      }
    } catch (error) {
      console.error('Error checking ebook status:', error);
      setResult({
        status: 'error',
        message: 'Error checking generation status.'
      });
      setGenerationProgress(null); // Clear progress on error
    } finally {
      setLoading(false); // Only set loading to false when generation is truly complete or failed
    }
  };

  // Download PDF function and JSX remain the same...
  const downloadPdf = async (ebookId, title) => {
    try {
      const response = await ebookAPI.download(ebookId);
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto min-h-[500px]"
    >
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          Generate Your Ebook
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Your form inputs remain the same */}
          <div>
            <label htmlFor="ebookTopic" className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
              Ebook Topic *
            </label>
            <input
              id="ebookTopic"
              type="text"
              required
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="e.g., Digital Marketing, Python Programming, Healthy Cooking"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
              Number of Chapters *
            </label>
            <input
              type="number"
              required
              min="2"
              max="20"
              value={formData.numberOfChapters}
              onChange={(e) => setFormData({ ...formData, numberOfChapters: parseInt(e.target.value) })}
              placeholder="e.g., 5, 10, 20"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
            />
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              (Minimum 2, Maximum 20 chapters)
            </p>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
                        className={`w-full py-2.5 px-4 rounded-lg font-semibold text-white text-base sm:text-lg ${
                          loading
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600'
                        } transition duration-200`}          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                {getProgressMessage()}
              </div>
            ) : (
              'Generate Ebook'
            )}
          </motion.button>
        </form>

        {/* Results section remains the same */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 p-3 rounded-lg text-sm sm:text-base ${
              result.status === 'error' 
                ? 'bg-red-50 border border-red-200 text-red-700'
                : result.status === 'completed'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-blue-50 border border-blue-200 text-blue-700'
            }`}
          >
            <div className="flex items-center">
              {result.status === 'generating' && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
              )}
              {result.status === 'completed' && (
                <div className="text-green-500 mr-3">✓</div>
              )}
              {result.status === 'error' && (
                <div className="text-red-500 mr-3">✗</div>
              )}
              <p>{result.status === 'generating' ? getProgressMessage() : result.message}</p>
            </div>

            {result.status === 'completed' && result.ebook && (
              <div className="mt-4 p-4 bg-white rounded border">
                <h3 className="font-bold text-base sm:text-lg mb-2">{result.ebook.title}</h3>
                <p className="text-gray-600 text-sm sm:text-base mb-4">{result.ebook.description}</p>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-sm sm:text-base mb-2">Chapters:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.ebook.chapters.map((chapter, index) => (
                      <li key={index} className="text-xs sm:text-sm text-gray-700">{chapter.title}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="flex space-x-4">
                  <button 
                    onClick={() => downloadPdf(result.ebook._id, result.ebook.title)}
                    className="bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 transition duration-200 text-sm sm:text-base"
                  >
                    📥 Download PDF
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default EbookGenerator;