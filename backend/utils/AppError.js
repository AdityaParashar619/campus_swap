export class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// HTTP error classes
export class BadRequest extends AppError {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

export class Unauthorized extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class Forbidden extends AppError {
  constructor(message = 'Access Forbidden') {
    super(message, 403);
  }
}

export class NotFound extends AppError {
  constructor(message = 'Resource Not Found') {
    super(message, 404);
  }
}

export class Conflict extends AppError {
  constructor(message = 'Resource Already Exists') {
    super(message, 409);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal Server Error') {
    super(message, 500);
  }
}
