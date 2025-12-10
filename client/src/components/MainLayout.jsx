import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import EbookGenerator from './EbookGenerator';
import PromptsGenerator from './PromptsGenerator';

import { healthCheck } from '../services/api';
import authService from '../services/authService';

const MainLayout = () => {
  const [activeTab, setActiveTab] = useState('ebook');
  const [apiStatus, setApiStatus] = useState('checking');
  const [user, setUser] = useState(null);

  // Check if user is logged in on component mount
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  // Check backend connection on component mount
  useEffect(() => {
    healthCheck()
      .then(() => setApiStatus('connected'))
      .catch(() => setApiStatus('disconnected'));
  }, []);

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    window.location.reload();
  };

  const tabs = [
    { id: 'ebook', label: '📚 Ebook Generator' },
    { id: 'prompts', label: '🤖 AI Prompts' },

  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10"
      >
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:max-w-7xl xl:max-w-screen-2xl">
          <div className="flex flex-col md:flex-row justify-between items-center py-3 sm:py-4 gap-4">
            <div className="text-center md:text-left mb-2 sm:mb-0">
              <motion.h1
                whileHover={{ scale: 1.02 }}
                className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900"
              >
                Digital Product Generator
              </motion.h1>
              <motion.p
                whileHover={{ scale: 1.02 }}
                className="text-sm sm:text-base md:text-lg text-gray-600 mt-0.5"
              >
                AI-Powered Ebooks & Prompts
              </motion.p>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center text-sm md:text-base ${apiStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}
              >
                <div className={`w-3 h-3 rounded-full mr-2 ${apiStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                API: {apiStatus}
              </motion.div>
              {user ? (
                <div className="flex items-center space-x-3">
                  <span className="text-gray-700 text-sm md:text-base">Welcome, {user.name}</span>
                  <motion.button
                    onClick={handleLogout}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-red-500 text-white px-3 py-1 rounded text-xs sm:text-sm hover:bg-red-600"
                  >
                    Logout
                  </motion.button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <motion.a
                    href="/login"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                  >
                    Login
                  </motion.a>
                  <motion.a
                    href="/register"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                  >
                    Register
                  </motion.a>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex justify-center md:justify-start gap-4 overflow-x-auto py-1">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative px-3 py-1.5 rounded-md font-medium text-sm md:text-base transition-colors duration-300 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"
                  />
                )}
              </motion.button>
            ))}
          </nav>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-grow max-w-xl mx-auto px-4 sm:px-6 lg:max-w-7xl xl:max-w-screen-xl py-6 pb-12">
        {!user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm md:text-base"
          >
            <div className="flex items-center">
              <div className="text-yellow-800">
                <strong>Authentication Required:</strong> Please{" "}
                <a href="/login" className="text-blue-600 underline">login</a> or{" "}
                <a href="/register" className="text-blue-600 underline">register</a> to generate digital products.
              </div>
            </div>
          </motion.div>
        )}

        {apiStatus === 'disconnected' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm md:text-base"
          >
            <div className="flex items-center">
              <div className="text-red-600 font-semibold">
                Backend server not connected. Please make sure the server is running on port 5000.
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'ebook' && <EbookGenerator />}
        {activeTab === 'prompts' && <PromptsGenerator />}

      </main>

    </div>
  );
};

export default MainLayout;