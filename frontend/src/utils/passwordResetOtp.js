export const createPasswordResetOtpPayload = (email, otp) => ({
  email: String(email || '').trim().toLowerCase(),
  otp: String(otp ?? '').trim()
});
