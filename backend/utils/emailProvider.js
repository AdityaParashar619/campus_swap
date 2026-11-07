import { env } from '../config/env.js';

export const sendVerificationCode = async ({ to, code }) => {
  if (env.nodeEnv === 'production' && env.otpMockEnabled) {
    throw new Error('Mock email provider cannot be enabled in production');
  }
  if (env.otpMockEnabled && env.nodeEnv !== 'production') {
    // Return only a development test code in the API response; never log it.
    return { previewCode: code };
  }
  if (!env.emailProviderUrl || !env.emailProviderApiKey) throw new Error('Email provider is not configured');
  const response = await fetch(env.emailProviderUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.emailProviderApiKey}` },
    body: JSON.stringify({ template: 'campusswap-student-verification', to, data: { code } })
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  return {};
};

export const sendPasswordReset = async ({ to, resetUrl, template = 'campusswap-password-reset' }) => {
  if (!env.emailProviderUrl || !env.emailProviderApiKey) {
    if (env.nodeEnv === 'production') throw new Error('Email provider is not configured');
    if (env.otpMockEnabled) return { accepted: true };
    return {};
  }
  const response = await fetch(env.emailProviderUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.emailProviderApiKey}` },
    body: JSON.stringify({ template, to, data: { resetUrl } })
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  return {};
};
