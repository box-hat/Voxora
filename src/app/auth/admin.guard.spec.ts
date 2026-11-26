import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';

import { adminGuard } from './admin.guard';
import { RealtimeService } from '../services/realtime';

describe('adminGuard', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RealtimeService, useValue: { restart: () => Promise.resolve() } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  const runGuard = (url: string) =>
    TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;

  it('allows signed-in admins', async () => {
    const result = firstValueFrom(runGuard('/reports'));
    http.expectOne('/api/auth/me').flush({ id: 1, username: 'admin', fullName: 'Admin' });

    expect(await result).toBe(true);
  });

  it('sends everyone else to the login page with a return URL', async () => {
    const result = firstValueFrom(runGuard('/reports'));
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    const tree = (await result) as UrlTree;
    expect(router.serializeUrl(tree)).toBe('/admin-login?returnUrl=%2Freports');
  });
});
