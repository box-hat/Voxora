import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../services/auth';

/** Only signed-in admins may open admin pages. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);

  return inject(AuthService).isSignedIn().pipe(
    map(signedIn => signedIn
      ? true
      : router.createUrlTree(['/admin-login'], { queryParams: { returnUrl: state.url } }))
  );
};

/** Signed-in admins skip the login page. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);

  return inject(AuthService).isSignedIn().pipe(
    map(signedIn => signedIn ? router.createUrlTree(['/admin-dashboard']) : true)
  );
};
