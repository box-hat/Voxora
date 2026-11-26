import { HttpErrorResponse } from '@angular/common/http';

import { getErrorMessage } from './http-error';

const response = (status: number, error: unknown) =>
  new HttpErrorResponse({ status, error });

describe('getErrorMessage', () => {
  it('uses the API message', () => {
    expect(getErrorMessage(response(400, { message: 'Subject is too short.' }), 'x'))
      .toBe('Subject is too short.');
  });

  it('keeps the server message for a failed login (401)', () => {
    expect(getErrorMessage(response(401, { message: 'Invalid username or password.' }), 'x'))
      .toBe('Invalid username or password.');
  });

  it('explains an expired session when a 401 has no message', () => {
    expect(getErrorMessage(response(401, null), 'x')).toContain('session has expired');
  });

  it('accepts plain-text bodies', () => {
    expect(getErrorMessage(response(409, 'Already exists.'), 'x')).toBe('Already exists.');
  });

  it('does not show server error titles to users', () => {
    expect(getErrorMessage(response(500, { title: 'NullReferenceException' }), 'Try again.'))
      .toBe('Try again.');
  });

  it('reports an unreachable server', () => {
    expect(getErrorMessage(response(0, null), 'x')).toContain('Cannot reach the server');
  });

  it('falls back for non-HTTP errors', () => {
    expect(getErrorMessage(new Error('boom'), 'Fallback.')).toBe('Fallback.');
  });
});
