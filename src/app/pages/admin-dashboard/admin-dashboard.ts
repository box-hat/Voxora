
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import {
  ConcernService,
  AdminConcern
} from '../../services/concern';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { RealtimeService } from '../../services/realtime';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboard implements OnInit {

  concerns: AdminConcern[] = [];

  totalConcerns = 0;
  pendingConcerns = 0;
  underReviewConcerns = 0;
  resolvedConcerns = 0;
  rejectedConcerns = 0;

  categoryStats: {
    name: string;
    count: number;
    percentage: number;
  }[] = [];

  isLoading = false;

  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);

  constructor(
    private concernService: ConcernService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadConcerns();

    // Refresh automatically when concerns change (SignalR)
    this.realtime.concernsChanged$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadConcerns());

    this.realtime.connect().catch(() => {});
  }

  // LOAD CONCERNS FROM MYSQL DATABASE
  loadConcerns(): void {

    this.isLoading = true;

    this.concernService.getAllConcerns().subscribe({

      next: data => {

        this.concerns = data;

        this.calculateStats();

        this.isLoading = false;

        console.log('DASHBOARD DATA LOADED:', data);

        this.cdr.detectChanges();
      },

      error: error => {

        this.isLoading = false;

        console.error('DASHBOARD ERROR:', error);

        alert(
          error.error?.message ||
          error.error ||
          'Unable to load dashboard data.'
        );

        this.cdr.detectChanges();
      }

    });
  }

  // CALCULATE DASHBOARD STATISTICS
  calculateStats(): void {

    this.totalConcerns = this.concerns.length;

    this.pendingConcerns = this.concerns.filter(
      concern => concern.status === 'Pending'
    ).length;

    this.underReviewConcerns = this.concerns.filter(
      concern => concern.status === 'Under Review'
    ).length;

    this.resolvedConcerns = this.concerns.filter(
      concern => concern.status === 'Resolved'
    ).length;

    this.rejectedConcerns = this.concerns.filter(
      concern => concern.status === 'Rejected'
    ).length;

    // CATEGORY ANALYTICS
    const categoryCounts: { [key: string]: number } = {};

    this.concerns.forEach(concern => {

      const category = concern.category || 'Uncategorized';

      categoryCounts[category] =
        (categoryCounts[category] || 0) + 1;

    });

    this.categoryStats = Object.keys(categoryCounts).map(name => ({

      name,

      count: categoryCounts[name],

      percentage: this.totalConcerns
        ? (categoryCounts[name] / this.totalConcerns) * 100
        : 0

    }));
  }

  // GET LATEST FIVE CONCERNS
  get recentConcerns(): AdminConcern[] {

    return [...this.concerns]

      .sort((a, b) =>
        new Date(b.submittedAt).getTime() -
        new Date(a.submittedAt).getTime()
      )

      .slice(0, 5);
  }

  // FORMAT DATE
  formatDate(date: string): string {

    if (!date) return 'N/A';

    return new Date(date).toLocaleDateString('en-PH', {

      month: 'short',
      day: 'numeric',
      year: 'numeric'

    });
  }

  // STATUS BADGE CLASS
  getStatusClass(status: string): string {

    return status.toLowerCase().replace(/\s+/g, '-');
  }

  // LOGOUT
  logout(): void {

    window.location.href = '/admin-login';
  }
}
