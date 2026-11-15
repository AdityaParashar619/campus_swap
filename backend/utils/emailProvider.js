import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { captureDevelopmentMail } from './devMailCapture.js';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const unavailable = (message, deliveryCategory = 'provider_error') => Object.assign(new Error(message), { deliveryCategory });

const smtpFailureCategory = (error) => {
  if (error?.code === 'EAUTH') return 'smtp_authentication';
  if (error?.code === 'ETIMEDOUT') return 'smtp_timeout';
  if (['ECONNECTION', 'ESOCKET', 'EDNS'].includes(error?.code)) return 'smtp_connection';
  if (error?.code === 'EENVELOPE') return 'smtp_envelope_rejected';
  if (error?.code === 'EMESSAGE') return 'smtp_message_rejected';
  if (Number.isInteger(error?.responseCode)) return `smtp_response_${Math.floor(error.responseCode / 100)}xx`;
  return 'smtp_unknown';
};

export const createEmailProvider = ({ clientFactory = async (apiKey) => { const { Resend } = await import('resend'); return new Resend(apiKey); }, transportFactory = (options) => nodemailer.createTransport(options), configuration = env, captureMail = captureDevelopmentMail, logger = console } = {}) => {
  let cachedClient;
  let cachedApiKey;
  let cachedTransport;

  const getTransport = () => {
    if (!configuration.gmailUser || !configuration.gmailAppPassword) throw unavailable('Email delivery is not configured.');
    if (!cachedTransport) cachedTransport = transportFactory({
      service: 'gmail',
      auth: { user: configuration.gmailUser, pass: configuration.gmailAppPassword }
    });
    return cachedTransport;
  };

  const getClient = () => {
    if (!configuration.resendApiKey) throw unavailable('Email delivery is not configured.');
    if (!cachedClient || cachedApiKey !== configuration.resendApiKey) {
      cachedClient = Promise.resolve(clientFactory(configuration.resendApiKey));
      cachedApiKey = configuration.resendApiKey;
    }
    return cachedClient;
  };

  const sendWithResend = async ({ to, subject, html, text }) => {
    if (configuration.nodeEnv === 'production' && !configuration.resendDomainVerified) throw unavailable('Email delivery is unavailable until the Resend sending domain is verified.', 'resend_domain_unverified');
    if (!configuration.resendApiKey || !configuration.emailFrom) throw unavailable('Email delivery is not configured.', 'provider_configuration_missing');
    const recipients = configuration.resendTestMode ? [configuration.resendTestRecipient] : [to];
    try {
      const { data, error } = await (await getClient()).emails.send({
        from: configuration.emailFrom,
        to: recipients,
        subject,
        html,
        text
      }, { signal: AbortSignal.timeout(10_000) });
      if (error || !data?.id) throw unavailable('Resend rejected the email request.', 'resend_rejected');
      return {};
    } catch (error) {
      // Do not surface SDK/provider payloads: they may contain recipient or request details.
      throw unavailable('Email delivery failed. Check server-side provider status using the request ID.', error?.deliveryCategory || 'resend_transport');
    }
  };

  const send = async ({ to, subject, html, text, purpose, requestId }) => {
    const provider = configuration.emailProvider;
    const log = (level, event, extra = {}) => logger[level](JSON.stringify({ event, provider, purpose, ...(requestId ? { requestId } : {}), ...extra }));
    log('info', 'auth_email_send_attempted');
    try {
      let outcome = {};
      if (provider === 'gmail') {
        if (!configuration.gmailUser || !configuration.gmailAppPassword) throw unavailable('Email delivery is not configured.', 'provider_configuration_missing');
        let info;
        try {
          info = await getTransport().sendMail({ from: configuration.emailFrom, to, subject, html, text });
        } catch (error) {
          throw unavailable('Email delivery failed. Check server-side provider status using the request ID.', smtpFailureCategory(error));
        }
        const acceptedRecipient = Array.isArray(info?.accepted)
          && info.accepted.some((address) => String(address).trim().toLowerCase() === String(to).trim().toLowerCase());
        if (!acceptedRecipient) throw unavailable('Email delivery failed. Check server-side provider status using the request ID.', info?.rejected?.length ? 'smtp_recipient_rejected' : 'smtp_no_accepted_recipient');
        const responseCode = /^([0-9]{3})\b/.exec(String(info.response || ''))?.[1];
        outcome = { result: 'accepted_by_smtp', ...(responseCode ? { smtpResponseCode: Number(responseCode) } : {}) };
      } else {
        await sendWithResend({ to, subject, html, text });
        outcome = { result: 'accepted_by_provider' };
      }
      log('info', provider === 'gmail' ? 'auth_email_smtp_accepted' : 'auth_email_provider_accepted', outcome);
      return {};
    } catch (error) {
      log('warn', provider === 'gmail' ? 'auth_email_smtp_rejected' : 'auth_email_provider_failed', { failureCategory: error?.deliveryCategory || 'provider_error' });
      throw error;
    }
  };

  const verifyConnection = async () => {
    try {
      if (configuration.emailProvider === 'gmail') await getTransport().verify();
      else if (configuration.resendApiKey && configuration.emailFrom) return true;
      else throw unavailable('Email delivery is not configured.');
      return true;
    } catch {
      throw unavailable('Email provider connection verification failed.');
    }
  };

  const sendVerificationCode = async ({ to, code, requestId }) => {
    if (configuration.emailProvider !== 'gmail' && configuration.nodeEnv === 'production' && configuration.otpMockEnabled) {
      throw unavailable('Mock email delivery cannot be enabled in production.');
    }
    if (configuration.emailProvider !== 'gmail' && configuration.otpMockEnabled && configuration.nodeEnv === 'development') {
      return captureMail({ to, purpose: 'student-verification', code });
    }
    const safeCode = escapeHtml(code);
    return send({
      to,
      purpose: 'student-verification',
      requestId,
      subject: 'Verify your CampusSwap account',
      html: `<p>Your CampusSwap verification code is <strong>${safeCode}</strong>.</p><p>This code expires soon. If you did not request it, you can ignore this message.</p>`,
      text: `Your CampusSwap verification code is ${code}. If you did not request it, you can ignore this message.`
    });
  };

  const sendPasswordResetCode = async ({ to, code, requestId }) => {
    if (configuration.emailProvider !== 'gmail' && configuration.otpMockEnabled && configuration.nodeEnv === 'development') {
      return captureMail({ to, purpose: 'password-reset', code });
    }
    const safeCode = escapeHtml(code);
    return send({
      to,
      purpose: 'password-reset',
      requestId,
      subject: 'Reset your CampusSwap password',
      html: `<p>Your CampusSwap password-reset code is <strong>${safeCode}</strong>.</p><p>This code expires soon. If you did not request it, you can ignore this message.</p>`,
      text: `Your CampusSwap password-reset code is ${code}. If you did not request it, you can ignore this message.`
    });
  };

  const sendPasswordReset = async ({ to, resetUrl, template = 'campusswap-password-reset', requestId }) => {
    if (configuration.emailProvider !== 'gmail' && configuration.otpMockEnabled && configuration.nodeEnv === 'development') {
      return captureMail({ to, purpose: template, url: resetUrl });
    }
    const safeUrl = escapeHtml(resetUrl);
    const alumniVerification = template === 'campusswap-alumni-email-verification';
    const subject = alumniVerification ? 'Verify your CampusSwap alumni email' : 'Reset your CampusSwap password';
    const action = alumniVerification ? 'verify your email address' : 'reset your password';
    return send({
      to,
      purpose: template,
      requestId,
      subject,
      html: `<p>Use the link below to ${action}:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>If you did not request this, you can ignore this message.</p>`,
      text: `Use this link to ${action}: ${resetUrl}\nIf you did not request this, you can ignore this message.`
    });
  };

  const sendPasswordChangedConfirmation = async ({ to, requestId }) => {
    if (configuration.emailProvider !== 'gmail' && configuration.nodeEnv === 'development' && configuration.otpMockEnabled) return { accepted: true };
    return send({
      to,
      purpose: 'password-changed-confirmation',
      requestId,
      subject: 'Your CampusSwap password was changed',
      html: '<p>Your CampusSwap password was changed. If you did not make this change, contact support immediately.</p>',
      text: 'Your CampusSwap password was changed. If you did not make this change, contact support immediately.'
    });
  };

  return { sendVerificationCode, sendPasswordResetCode, sendPasswordReset, sendPasswordChangedConfirmation, verifyConnection };
};

const emailProvider = createEmailProvider();
export const { sendVerificationCode, sendPasswordResetCode, sendPasswordReset, sendPasswordChangedConfirmation } = emailProvider;
export const verifyEmailProviderConnection = emailProvider.verifyConnection;
