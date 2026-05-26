export const validateBody = (requiredFields = []) => (req, _res, next) => {
  const missing = requiredFields.filter((field) => {
    const value = req.body?.[field];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missing.length > 0) {
    return next({
      status: 400,
      message: `Missing required fields: ${missing.join(', ')}`
    });
  }

  next();
};

export const validateAuthPayload = (mode = 'login') => (req, _res, next) => {
  const errors = {};
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();
  const enrollmentNumber = String(req.body?.enrollmentNumber || '').trim();

  if (!email) {
    errors.email = 'Email is required';
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = 'Please provide a valid email';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (mode === 'register') {
    if (!name) errors.name = 'Name is required';
    if (name.length > 60) errors.name = 'Name is too long';
    if (!enrollmentNumber) errors.enrollmentNumber = 'Enrollment number is required';
  }

  if (Object.keys(errors).length > 0) {
    return next({ status: 400, message: 'Validation failed', details: errors });
  }

  req.body.email = email;
  req.body.password = password;
  if (mode === 'register') {
    req.body.name = name;
    req.body.enrollmentNumber = enrollmentNumber;
  }

  next();
};
