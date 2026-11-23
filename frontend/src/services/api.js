import axios from 'axios';
import { shouldRefreshAfterUnauthorized } from '../utils/authRequestPolicy';
import { createSingleFlight } from '../utils/singleFlight';

let accessToken = null;
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

export const refreshAuthSession = createSingleFlight(() => API.post('/auth/refresh'));

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

    if (shouldRefreshAfterUnauthorized({ status: error.response?.status, url: error.config?.url || '', retried: error.config?._retried })) {
      error.config._retried = true;
      try {
        const refreshed = await refreshAuthSession();
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
  verifyPasswordResetOtp: (data) => API.post('/auth/verify-reset-otp', data),
  resetPassword: (data) => API.post('/auth/reset-password', data),
  previewDevelopmentMail: (previewToken) => API.post('/auth/dev-mail-preview', { previewToken }),
  getUsers: (config) => API.get('/auth/users', config),
  getMe: () => API.get('/auth/me'),
  updateMe: (data) => API.patch('/auth/me', data),
  uploadAvatar: (file) => {
    const data = new FormData(); data.append('avatar', file);
    return API.post('/auth/me/avatar', data, { timeout: 60000 });
  }
};

export const academicAPI = {
  getMyResources: (config) => API.get('/academic/my-resources', config)
};

export const noticeAPI = {
  getAll: (params, options = {}) => API.get('/notices', { params, signal: options.signal }),
  getById: (id, options = {}) => API.get(`/notices/${id}`, { signal: options.signal })
};

export const campusLocationAPI = {
  getAll: (params, { signal } = {}) => API.get('/campus-locations', { params, signal }),
  getById: (id, { signal } = {}) => API.get(`/campus-locations/${encodeURIComponent(id)}`, { signal })
};

const adminLocationPath = '/admin/campus-locations';
const locationPath = (id) => `${adminLocationPath}/${encodeURIComponent(id)}`;
const locationVersion = (version) => {
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('Reload the saved location before making changes.');
  return { headers: { 'If-Match': `"${version}"` } };
};

export const adminCampusLocationAPI = {
  list: (params, signal) => API.get(adminLocationPath, { params, signal }),
  get: (id, signal) => API.get(locationPath(id), { signal }),
  create: (data) => API.post(adminLocationPath, data),
  update: (id, data, version) => API.patch(locationPath(id), data, locationVersion(version)),
  verify: (id, data, version) => API.post(`${locationPath(id)}/verify-coordinates`, data, locationVersion(version)),
  publish: (id, version) => API.post(`${locationPath(id)}/publish`, {}, locationVersion(version)),
  archive: (id, version) => API.post(`${locationPath(id)}/archive`, {}, locationVersion(version))
};

export const listingAPI = {
  getAll: (params, options = {}) => API.get('/listings', { params, signal: options.signal }),
  getById: (id, options = {}) => API.get(`/listings/${id}`, { signal: options.signal }),
  getMine: (params, options = {}) => API.get('/listings/mine', { params, signal: options.signal }),
  getSaved: (params, options = {}) => API.get('/listings/saved', { params, signal: options.signal }),
  getFavoriteStatuses: (listingIds, options = {}) => API.post('/listings/favorites/status', { listingIds }, { signal: options.signal }),
  create: (data) => API.post('/listings', data),
  update: (id, data) => API.patch(`/listings/${id}`, data),
  delete: (id) => API.delete(`/listings/${id}`),
  toggleFavorite: (id) => API.post(`/listings/${id}/favorite`),
  addFavorite: (id) => API.put(`/listings/${id}/favorite`),
  removeFavorite: (id) => API.delete(`/listings/${id}/favorite`),
  uploadImages: (files) => {
    const data = new FormData();
    files.forEach((file) => data.append('images', file));
    return API.post('/listings/images', data, { timeout: 60000 });
  },
  deletePendingImage: (id) => API.delete(`/listings/images/${id}`)
};

export const requestAPI = {
  getAll: (params, config) => API.get('/requests', { ...config, params }),
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
  getStudent: (userId, config) => API.get(`/connections/students/${userId}`, config),
  create: (recipientId) => API.post('/connections', { recipientId }),
  respond: (id, status) => API.patch(`/connections/${id}/respond`, { status })
};

export const notificationAPI = {
  getAll: (params) => API.get('/notifications', { params }),
  getUnreadCount: () => API.get('/notifications/unread-count'),
  markRead: (id) => API.patch(`/notifications/${id}/read`),
  markAllRead: () => API.patch('/notifications/read-all')
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
  ,academicResources: (params) => API.get('/admin/academic-resources', { params })
  ,createAcademicResource: (data) => API.post('/admin/academic-resources', data)
  ,updateAcademicResource: (id, data) => API.patch(`/admin/academic-resources/${id}`, data)
  ,setAcademicResourceStatus: (id, data) => API.patch(`/admin/academic-resources/${id}/status`, data)
  ,notices: (params, options = {}) => API.get('/admin/notices', { params, signal: options.signal })
  ,notice: (id, options = {}) => API.get(`/admin/notices/${id}`, { signal: options.signal })
  ,createNotice: (data) => API.post('/admin/notices', data)
  ,updateNotice: (id, data) => API.patch(`/admin/notices/${id}`, data)
  ,uploadNoticeAttachments: (id, files, onUploadProgress) => {
    const form = new FormData(); files.forEach((file) => form.append('attachments', file));
    return API.post(`/admin/notices/${id}/attachments`, form, { onUploadProgress });
  }
  ,removeNoticeAttachment: (noticeId, attachmentId) => API.delete(`/admin/notices/${noticeId}/attachments/${attachmentId}`)
  ,publishNotice: (id) => API.post(`/admin/notices/${id}/publish`, {})
  ,archiveNotice: (id) => API.post(`/admin/notices/${id}/archive`, {})
};

export const messageAPI = {
  send: (data) => API.post('/messages', data),
  getChat: (userId, config) => API.get(`/messages/${userId}`, config),
  getSummaries: (params = {}, config) => API.get('/messages/summaries', { ...config, params })
};

export default API;
