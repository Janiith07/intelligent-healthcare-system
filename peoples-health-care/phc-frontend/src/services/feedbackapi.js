import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Helper: attach JWT token from sessionStorage
const authHeaders = () => ({
  headers: {
    Authorization: `Bearer ${sessionStorage.getItem('token')}`,
  },
});

// ── Patient ───────────────────────────────────────────────────────────────────

// Submit a new feedback (patient only)
export const submitFeedback = (data) =>
  axios.post(`${API_BASE}/feedback`, data, authHeaders());

// Get current patient's own past feedbacks
export const getMyFeedbacks = () =>
  axios.get(`${API_BASE}/feedback/my`, authHeaders());

// Delete patient's own feedback by ID
export const deleteMyFeedback = (id) =>
  axios.delete(`${API_BASE}/feedback/${id}`, authHeaders());

// ── Cashier / Admin ───────────────────────────────────────────────────────────

// Get all feedbacks — optional params: { rating, page, limit }
export const getAllFeedback = (params = {}) =>
  axios.get(`${API_BASE}/feedback`, { ...authHeaders(), params });

// Get rating distribution for the chart
export const getRatingDistribution = () =>
  axios.get(`${API_BASE}/feedback/distribution`, authHeaders());

// Delete a feedback by ID (cashier only)
export const deleteFeedback = (id) =>
  axios.delete(`${API_BASE}/feedback/${id}`, authHeaders());