import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1',
  timeout: 30000
});

export function errorMessage(error) {
  return error.response?.data?.error?.message || error.message || 'Something went wrong. Please try again.';
}

export default api;
