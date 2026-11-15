export const getPasswordPolicy = (password) => ({
  minLength: typeof password === 'string' && password.length >= 8,
  maxLength: typeof password === 'string' && password.length <= 128,
  uppercase: typeof password === 'string' && /[A-Z]/.test(password),
  lowercase: typeof password === 'string' && /[a-z]/.test(password),
  number: typeof password === 'string' && /[0-9]/.test(password),
  special: typeof password === 'string' && /[^A-Za-z0-9]/.test(password)
});

export const isPasswordStrong = (password) => Object.values(getPasswordPolicy(password)).every(Boolean);
