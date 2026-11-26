import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth';

/** When the admin session expires mid-use, go back to the login page. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isAuthCall = req.url.startsWith('/api/auth/');

      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthCall) {
        auth.clearSession();
        router.navigate(['/admin-login'], {
          queryParams: { returnUrl: router.url, expired: 1 }
        });
      }

      return throwError(() => error);
    })
  );
};
