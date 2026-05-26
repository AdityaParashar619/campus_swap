import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalizedMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Request failed';

    error.userMessage = normalizedMessage;

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  forgotPassword: (data) => API.post('/auth/forgot-password', data),
  resetPassword: (data) => API.post('/auth/reset-password', data),
  getUsers: () => API.get('/auth/users'),
  getMe: () => API.get('/auth/me'),
  updateMe: (data) => API.patch('/auth/me', data)
};

export const listingAPI = {
  getAll: (params) => API.get('/listings', { params }),
  create: (data) => API.post('/listings', data),
  update: (id, data) => API.patch(`/listings/${id}`, data),
  delete: (id) => API.delete(`/listings/${id}`),
  toggleFavorite: (id) => API.post(`/listings/${id}/favorite`)
};

export const requestAPI = {
  getAll: () => API.get('/requests'),
  create: (data) => API.post('/requests', data),
  respond: (id, message) => API.post(`/requests/${id}/responses`, { message }),
  updateStatus: (id, status, fulfilledBy) => API.patch(`/requests/${id}/status`, { status, fulfilledBy })
};

export const noteAPI = {
  getAll: (params) => API.get('/notes', { params }),
  create: (data) => API.post('/notes', data),
  toggleBookmark: (id) => API.post(`/notes/${id}/bookmark`)
};

export const connectionAPI = {
  getAll: () => API.get('/connections'),
  getSuggestions: () => API.get('/connections/suggestions'),
  create: (recipientId) => API.post('/connections', { recipientId }),
  respond: (id, status) => API.patch(`/connections/${id}/respond`, { status })
};

export const notificationAPI = {
  getAll: () => API.get('/notifications'),
  markRead: (id) => API.patch(`/notifications/${id}/read`)
};

export const reportAPI = {
  create: (data) => API.post('/reports', data),
  getMine: () => API.get('/reports/mine')
};

export const adminAPI = {
  overview: () => API.get('/admin/overview'),
  reports: () => API.get('/admin/reports'),
  users: () => API.get('/admin/users'),
  listings: () => API.get('/admin/listings'),
  updateReportStatus: (id, data) => API.patch(`/admin/reports/${id}/status`, data),
  takeReportAction: (id, data) => API.patch(`/admin/reports/${id}/action`, data),
  setUserBlocked: (id, isBlocked) => API.patch(`/admin/users/${id}/block`, { isBlocked }),
  setListingHidden: (id, isHidden) => API.patch(`/admin/listings/${id}/hide`, { isHidden })
};

export const messageAPI = {
  send: (data) => API.post('/messages', data),
  getChat: (userId) => API.get(`/messages/${userId}`)
};

export default API;
