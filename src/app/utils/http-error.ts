import { HttpErrorResponse } from '@angular/common/http';

/** A user-facing message for a failed API call. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'Cannot reach the server. Check your connection and try again.';
  }

  const body = error.error;

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (body && typeof body === 'object') {
    if (typeof body.message === 'string') return body.message;
    if (typeof body.detail === 'string') return body.detail;
    if (typeof body.title === 'string' && error.status < 500 && error.status !== 401) {
      return body.title;
    }
  }

  if (error.status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  return fallback;
}
