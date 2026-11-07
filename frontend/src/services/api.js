import axios from 'axios';

let accessToken = null;
let refreshInFlight = null;
export const setAccessToken = (token) => { accessToken = token || null; };
export const getAccessToken = () => accessToken;

const getApiBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return configuredBaseUrl || '/api';
};

export const getApiErrorMessage = (error, fallback = 'Request failed') =>
  error?.code === 'ECONNABORTED'
    ? 'The server did not respond in time. It may be starting up; please retry in a moment.'
    : error?.userMessage ||
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      fallback;

const API = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  withCredentials: true
});

API.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const contentType = error?.response?.headers?.['content-type'] || '';
    const returnedHtml = typeof error?.response?.data === 'string' && /text\/html/i.test(contentType);
    const normalizedMessage =
      (returnedHtml
        ? 'The API endpoint returned the web app instead of JSON. Configure the deployed backend URL/API proxy.'
        : null) ||
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Request failed';

    error.userMessage = normalizedMessage;

    const publicAuthRequest = /\/auth\/(login|register(?:\/student|\/alumni)?|verify-email|verify-alumni-email|resend-otp|forgot-password|reset-password)$/.test(error.config?.url || '');
    if (error.response?.status === 401 && !publicAuthRequest && !error.config?._retried && !error.config?.url?.includes('/auth/refresh')) {
      error.config._retried = true;
      try {
        refreshInFlight ||= API.post('/auth/refresh').finally(() => { refreshInFlight = null; });
        const refreshed = await refreshInFlight;
        setAccessToken(refreshed.data.token);
        error.config.headers.Authorization = `Bearer ${refreshed.data.token}`;
        return API.request(error.config);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new Event('campusswap:session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  registerStudent: (data) => API.post('/auth/register/student', data),
  registerAlumni: (data) => API.post('/auth/register/alumni', data),
  verifyAlumniEmail: (data) => API.post('/auth/verify-alumni-email', data),
  verifyEmail: (data) => API.post('/auth/verify-email', data),
  resendOtp: (data) => API.post('/auth/resend-otp', data),
  login: (data) => API.post('/auth/login', data),
  refresh: () => API.post('/auth/refresh'),
  logout: () => API.post('/auth/logout'),
  updatePassword: (data) => API.patch('/auth/me/password', data),
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
  setListingHidden: (id, isHidden) => API.patch(`/admin/listings/${id}/hide`, { isHidden }),
  iamUsers: (params) => API.get('/admin/iam/users', { params }),
  iamUser: (id) => API.get(`/admin/iam/users/${id}`),
  updateIamStatus: (id, data) => API.patch(`/admin/iam/users/${id}/status`, data),
  updateIamRole: (id, data) => API.patch(`/admin/iam/users/${id}/role`, data),
  alumniVerifications: () => API.get('/admin/iam/verifications/alumni'),
  reviewAlumni: (id, data) => API.patch(`/admin/iam/verifications/alumni/${id}`, data)
};

export const messageAPI = {
  send: (data) => API.post('/messages', data),
  getChat: (userId) => API.get(`/messages/${userId}`)
};

export default API;
