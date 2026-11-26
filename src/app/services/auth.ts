import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { RealtimeService } from './realtime';

export interface AdminUser {
  id: number;
  username: string;
  fullName: string;
}

/**
 * Admin session. The session itself is an HttpOnly cookie set by the API,
 * so it is never readable from JavaScript; this service only caches who
 * is signed in.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly http = inject(HttpClient);
  private readonly realtime = inject(RealtimeService);
  private readonly apiUrl = '/api/auth';

  /** Signed-in admin; undefined = not checked yet, null = signed out. */
  readonly currentAdmin = signal<AdminUser | null | undefined>(undefined);

  login(username: string, password: string, rememberMe: boolean): Observable<AdminUser> {
    return this.http
      .post<AdminUser>(`${this.apiUrl}/login`, { username, password, rememberMe })
      .pipe(tap(admin => {
        this.currentAdmin.set(admin);
        // Reconnect so the SignalR connection is authenticated as admin.
        this.realtime.restart();
      }));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout`, {}).pipe(
      catchError(() => of(undefined)),
      map(() => undefined),
      tap(() => this.clearSession())
    );
  }

  /** Clear local state after the server rejected the session (401). */
  clearSession(): void {
    if (this.currentAdmin() !== null) {
      this.currentAdmin.set(null);
      this.realtime.restart();
    }
  }

  /** True if signed in. Asks the API once, then uses the cached answer. */
  isSignedIn(): Observable<boolean> {
    const cached = this.currentAdmin();
    if (cached !== undefined) {
      return of(cached !== null);
    }

    return this.http.get<AdminUser>(`${this.apiUrl}/me`).pipe(
      tap(admin => this.currentAdmin.set(admin)),
      map(() => true),
      catchError(() => {
        this.currentAdmin.set(null);
        return of(false);
      })
    );
  }
}
