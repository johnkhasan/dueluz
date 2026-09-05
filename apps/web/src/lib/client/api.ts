'use client';

import type { ApiResponse } from '@/lib/api';
import type { ErrorCode } from '@/lib/errors';

export class ApiClientError extends Error {
  readonly code: ErrorCode | 'NETWORK';
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode | 'NETWORK', message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Field-level messages produced by a zod validation failure. */
  get fieldErrors(): Record<string, string> {
    return this.details && typeof this.details === 'object'
      ? (this.details as Record<string, string>)
      : {};
  }
}

type RequestOptions = { method?: string; body?: unknown; signal?: AbortSignal };

/**
 * Thin fetch wrapper around the API envelope.
 *
 * Unwraps `{ success, data }` and turns `{ success: false, error }` into a
 * typed exception, so callers only handle the happy path plus one error type.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiClientError('NETWORK', 'Network request failed', 0);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!payload) {
    throw new ApiClientError('INTERNAL_ERROR', 'Malformed server response', response.status);
  }

  if (!payload.success) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.error.details,
    );
  }

  return payload.data;
}

export const apiGet = <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal });

/**
 * Same as `api`, but also returns the envelope's `meta` block. Used by the
 * paginated feeds, where the next cursor travels in meta rather than data.
 */
export async function apiWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta: Record<string, unknown> }> {
  const { method = 'GET', body, signal } = options;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiClientError('NETWORK', 'Network request failed', 0);
  }

  const payload = (await response.json().catch(() => null)) as
    | (ApiResponse<T> & { meta?: Record<string, unknown> })
    | null;

  if (!payload) {
    throw new ApiClientError('INTERNAL_ERROR', 'Malformed server response', response.status);
  }
  if (!payload.success) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.error.details,
    );
  }

  return { data: payload.data, meta: payload.meta ?? {} };
}
export const apiPost = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const apiPatch = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'DELETE', body });

/**
 * Fire-and-forget analytics beacon. Never awaited by UI code and never allowed
 * to surface an error.
 */
export function trackEvent(
  name: string,
  payload: { duelId?: string; locale?: string; props?: Record<string, string | number | boolean> } = {},
): void {
  void fetch('/api/events', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ name, ...payload }),
  }).catch(() => undefined);
}
