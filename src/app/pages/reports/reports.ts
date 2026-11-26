
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  AdminConcern,
  ConcernService,
  ReportConcern,
  ReportSummary
} from '../../services/concern';
import { AuthService } from '../../services/auth';
import { getErrorMessage } from '../../utils/http-error';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { RealtimeService } from '../../services/realtime';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reports.html',
  styleUrl: './reports.css'
})
export class Reports implements OnInit {

  private auth = inject(AuthService);
  private router = inject(Router);
  today = new Date();

  concerns: ReportConcern[] = [];
  isLoading = false;
  loadError = '';

  total = 0;
  categoryStats: { name: string; count: number; percentage: number }[] = [];

  statusStats: { name: string; count: number; percentage: number; className: string }[] = [];

  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);

  constructor(private concernService: ConcernService) {}

  ngOnInit(): void {
    this.loadReports();

    // Refresh automatically when concerns change (SignalR)
    this.realtime.concernsChanged$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadReports());

    this.realtime.connect().catch(() => {});
  }

  loadReports(): void {
    this.isLoading = true;
    this.loadError = '';

    this.concernService.getReportSummary().subscribe({
      next: summary => {
        this.applyReportSummary(summary);
        this.isLoading = false;
      },
      error: error => {
        this.concerns = [];
        this.total = 0;
        this.categoryStats = [];
        this.statusStats = [];
        this.isLoading = false;
        this.loadError = getErrorMessage(error, 'Unable to load report data.');
      }
    });
  }

  applyReportSummary(summary: ReportSummary): void {
    this.concerns = summary.recentConcerns;
    this.total = summary.statusCounts.reduce((sum, item) => sum + item.count, 0);

    const statusClasses: Record<string, string> = {
      'Pending': 'pending',
      'Under Review': 'under-review',
      'Resolved': 'resolved',
      'Rejected': 'rejected'
    };

    const statuses = ['Pending', 'Under Review', 'Resolved', 'Rejected']
      .map(name => ({
        name,
        count: summary.statusCounts.find(item => item.status === name)?.count ?? 0,
        className: statusClasses[name]
      }));

    this.statusStats = statuses.map(status => ({
      ...status,
      percentage: this.total ? (status.count / this.total) * 100 : 0
    }));

    this.categoryStats = summary.categoryCounts.map(category => ({
      ...category,
      percentage: this.total ? (category.count / this.total) * 100 : 0
    }));
  }

  get recentConcerns(): ReportConcern[] {
    return this.concerns;
  }

  formatDate(date: string): string {
    if (!date) return 'N/A';

    return new Date(date).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  exportCSV(): void {
    this.concernService.getAllConcerns().subscribe({
      next: concerns => this.downloadCSV(concerns),
      error: () => alert('Unable to load concerns for export.')
    });
  }

  private downloadCSV(concerns: AdminConcern[]): void {
    if (concerns.length === 0) {
      alert('There are no concerns to export yet.');
      return;
    }

    const headers = [
      'Tracking Code',
      'Category',
      'Subject',
      'Description',
      'Submitted Date',
      'Status',
      'Admin Response'
    ];

    const escapeCSV = (value: unknown): string => {
      const text = String(value ?? '').replace(/"/g, '""');
      return `"${text}"`;
    };

    const rows = concerns.map(concern => [
      concern.trackingCode,
      concern.category,
      concern.subject,
      concern.description,
      concern.submittedAt,
      concern.status,
      concern.adminResponse || ''
    ]);

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `VOXORA-Concerns-Report-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  printReport(): void {
    window.print();
  }

  // LOGOUT
  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/admin-login']));
  }
}
