import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth';
import { getErrorMessage } from '../../utils/http-error';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css'
})
export class AdminLogin implements OnInit {
  username = '';
  password = '';
  showPassword = false;
  rememberMe = false;
  errorMessage = '';
  isLoading = false;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('expired')) {
      this.errorMessage = 'Your session has expired. Please sign in again.';
    }
  }

  login(): void {
    this.errorMessage = '';

    if (!this.username.trim() || !this.password) {
      this.errorMessage = 'Please enter your username and password.';
      return;
    }

    if (this.isLoading) return;
    this.isLoading = true;

    this.auth.login(this.username.trim(), this.password, this.rememberMe).subscribe({
      next: () => {
        this.password = '';
        this.router.navigateByUrl(this.safeReturnUrl());
      },
      error: error => {
        this.isLoading = false;
        this.password = '';
        this.errorMessage = getErrorMessage(error, 'Unable to sign in. Please try again.');
        this.cdr.detectChanges();
      }
    });
  }

  // Only allow returning to an in-app path (no open redirects).
  private safeReturnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
    return url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/admin-login')
      ? url
      : '/admin-dashboard';
  }
}
