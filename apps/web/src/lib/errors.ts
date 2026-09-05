/**
 * Application error codes. These are part of the public API contract —
 * clients switch on `error.code`, never on the message.
 */
export const ERROR_CODES = {
  // generic
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,

  // auth
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  ACCOUNT_BANNED: 403,
  SESSION_EXPIRED: 401,
  WEAK_PASSWORD: 422,

  // duels
  DUEL_NOT_FOUND: 404,
  DUEL_NOT_PUBLISHED: 404,
  CATEGORY_NOT_FOUND: 404,
  OPTION_NOT_FOUND: 404,
  DUEL_LIMIT_REACHED: 429,

  // voting
  ALREADY_VOTED: 409,
  VOTE_CHANGE_NOT_ALLOWED: 409,

  // comments
  COMMENT_NOT_FOUND: 404,
  COMMENT_TOO_LONG: 422,

  // moderation
  ALREADY_REPORTED: 409,
  REPORT_NOT_FOUND: 404,

  // uploads
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  UPLOAD_FAILED: 500,

  // safety
  CSRF_FAILED: 403,
  SPAM_DETECTED: 422,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? defaultMessage(code));
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }
}

function defaultMessage(code: ErrorCode): string {
  return code
    .toLowerCase()
    .split('_')
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

export const notFound = (code: ErrorCode = 'NOT_FOUND', message?: string) =>
  new AppError(code, message);
export const forbidden = (message?: string) => new AppError('FORBIDDEN', message);
export const unauthorized = (message?: string) => new AppError('UNAUTHORIZED', message);
