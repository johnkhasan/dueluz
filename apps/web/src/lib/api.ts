import { NextResponse } from 'next/server';
import { ZodError, type TypeOf, type ZodTypeAny } from 'zod';
import { AppError, type ErrorCode } from './errors';
import { isDevelopment } from './env';

export type ApiSuccess<T> = { success: true; data: T; meta?: Record<string, unknown> };
export type ApiFailure = {
  success: false;
  error: { code: ErrorCode; message: string; details?: unknown };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data, ...(meta ? { meta } : {}) }, init);
}

export function created<T>(data: T, meta?: Record<string, unknown>) {
  return ok(data, meta, { status: 201 });
}

export function fail(code: ErrorCode, message: string, details?: unknown, status?: number) {
  const error = new AppError(code, message, details);
  return NextResponse.json<ApiFailure>(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status: status ?? error.status },
  );
}

/**
 * Converts anything thrown inside a route handler into the standard error
 * envelope. Unexpected errors are logged server-side and reported generically
 * so internals never leak to clients.
 */
export function toErrorResponse(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return fail('VALIDATION_ERROR', 'Request payload is invalid', flattenZodError(error));
  }

  console.error('[api] unhandled error', error);
  return fail(
    'INTERNAL_ERROR',
    isDevelopment && error instanceof Error ? error.message : 'Something went wrong',
  );
}

export function flattenZodError(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Wraps a route handler so every code path returns the standard envelope. */
export function handler<Args extends unknown[]>(
  fn: (request: Request, ...args: Args) => Promise<NextResponse> | NextResponse,
) {
  return async (request: Request, ...args: Args): Promise<NextResponse> => {
    try {
      return await fn(request, ...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/**
 * Parses and validates a JSON body, throwing an AppError on malformed input.
 *
 * Generic over the schema rather than over its output type, so schemas that
 * apply defaults or transforms report the parsed (output) shape to callers.
 */
export async function parseJson<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<TypeOf<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError('BAD_REQUEST', 'Request body must be valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', 'Request payload is invalid', flattenZodError(result.error));
  }
  return result.data;
}

/** Parses and validates query-string parameters. */
export function parseQuery<S extends ZodTypeAny>(request: Request, schema: S): TypeOf<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', 'Query parameters are invalid', flattenZodError(result.error));
  }
  return result.data;
}
