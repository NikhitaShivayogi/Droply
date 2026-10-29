import axios from 'axios';

// Get API URL from environment, with fallback
const apiUrl = typeof window !== 'undefined' && window.__DROPLY_API_URL__ 
  ? window.__DROPLY_API_URL__ 
  : (process.env.VITE_API_URL || 'http://localhost:4000/api/v1');

const api = axios.create({
  baseURL: apiUrl,
  timeout: 30000
});

export function errorMessage(error) {
  return error.response?.data?.error?.message || error.message || 'Something went wrong. Please try again.';
}

export default api;
