import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_REACT_APP_BACKEND_BASEURL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        if (user.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
          console.log('🔐 Adding auth token to request');
        }
      } catch (error) {
        console.error('❌ Error parsing user info:', error);
      }
    } else {
      console.log('⚠️ No user info found in localStorage');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('🔐 Authentication error - redirecting to login');
      localStorage.removeItem('userInfo');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Ebook API calls
export const ebookAPI = {
  generate: (data) => api.post('/ebooks/generate', data),
  getStatus: (id) => api.get(`/ebooks/${id}`),
  download: (id) => api.get(`/ebooks/${id}/download`, { responseType: 'blob' }),
};

// Prompts API calls
export const promptsAPI = {
  generate: (data) => api.post('/prompts/generate', data),
  getStatus: (id) => api.get(`/prompts/${id}`),
};



// Health check
export const healthCheck = () => api.get('/health');

export default api;