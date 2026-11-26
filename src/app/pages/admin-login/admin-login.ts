
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css'
})
export class AdminLogin {
  username = '';
  password = '';
  showPassword = false;
  rememberMe = false;
  errorMessage = '';
  isLoading = false;

  constructor(private router: Router) {}

  login(): void {
    this.errorMessage = '';

    if (!this.username.trim() || !this.password) {
      this.errorMessage = 'Please enter your username and password.';
      return;
    }

    this.isLoading = true;

    // Temporary demo credentials only.
    // Replace with API authentication before production.
    if (
      this.username.trim() === 'admin' &&
      this.password === 'Voxora@123'
    ) {
      this.router.navigate(['/admin-dashboard']);
    } else {
      this.errorMessage = 'Invalid username or password.';
      this.isLoading = false;
    }
  }
}
