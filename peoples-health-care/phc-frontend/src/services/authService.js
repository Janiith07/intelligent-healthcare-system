import api from './api';

const authService = {

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.success) {
      sessionStorage.setItem('token', response.data.token);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  login: async (identifier, password) => {
    // identifier can be email or username
    const response = await api.post('/auth/login', { identifier, password });
    if (response.data.success) {
      sessionStorage.setItem('token', response.data.token);
      sessionStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  },

  getCurrentUser: () => {
    try {
      const userStr = sessionStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  isLoggedIn: () => {
    return !!sessionStorage.getItem('token');
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

};

export default authService;