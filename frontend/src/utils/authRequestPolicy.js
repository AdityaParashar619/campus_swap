export const isPublicAuthRequest = (url = '') =>
  /\/auth\/(login|register(?:\/student|\/alumni)?|verify-email|verify-alumni-email|resend-otp|forgot-password|verify-reset-otp|reset-password)$/.test(url);

export const shouldRefreshAfterUnauthorized = ({ status, url = '', retried = false } = {}) =>
  status === 401 && !isPublicAuthRequest(url) && !retried && !url.includes('/auth/refresh');
