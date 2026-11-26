
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ConcernService,
  TrackedConcern
} from '../../services/concern';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { RealtimeService } from '../../services/realtime';

@Component({
  selector: 'app-track-concern',
  standalone: true,
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './track-concern.html',
  styleUrl: './track-concern.css'
})
export class TrackConcern implements OnInit {

  trackingCode = '';
  concern: TrackedConcern | null = null;

  searched = false;
  isSearching = false;

  private watchedCode = '';

  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private concernService: ConcernService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const code = params.get('code');

      if (code) {
        this.trackingCode = code;
        this.searchConcern();
      }
    });

    // Live status updates for the concern being viewed (SignalR)
    this.realtime.concernUpdated$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        if (event.trackingCode === this.concern?.trackingCode) {
          this.refreshConcern(event.trackingCode);
        }
      });

    this.destroyRef.onDestroy(() => this.setWatchedCode(''));
  }

  private setWatchedCode(code: string): void {
    if (code === this.watchedCode) return;

    if (this.watchedCode) {
      this.realtime.unwatchConcern(this.watchedCode);
    }

    this.watchedCode = code;

    if (code) {
      this.realtime.watchConcern(code);
    }
  }

  // Re-fetch without clearing the page (used for live updates)
  private refreshConcern(code: string): void {
    this.concernService.getConcernByTrackingCode(code).subscribe({
      next: data => {
        this.concern = data;
        this.cdr.detectChanges();
      },
      error: error => console.error('LIVE REFRESH ERROR:', error)
    });
  }

  searchConcern(): void {

    if (this.isSearching) {
      return;
    }

    const code = this.trackingCode
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');

    this.searched = true;

    if (!code) {
      this.concern = null;
      this.cdr.detectChanges();
      return;
    }

    this.trackingCode = code;
    this.concern = null;
    this.isSearching = true;

    this.cdr.detectChanges();

    console.log('Searching Tracking Code:', code);

    this.concernService
      .getConcernByTrackingCode(code)
      .subscribe({

        next: (data) => {

          this.concern = data;
          this.isSearching = false;
          this.searched = true;

          this.setWatchedCode(data.trackingCode);

          console.log('CONCERN FOUND:', data);

          // Update the page after receiving API response
          this.cdr.detectChanges();
        },

        error: (error) => {

          this.isSearching = false;

          console.error('TRACKING ERROR:', error);

          if (error.status === 404) {
            this.concern = null;
            this.setWatchedCode('');
            this.searched = true;
          } else {
            this.searched = false;

            alert(
              error.error?.message ||
              error.error ||
              'Unable to track your concern. Please try again.'
            );
          }

          this.cdr.detectChanges();
        }

      });
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get progress(): number {
    switch (this.concern?.status) {
      case 'Pending':
        return 25;

      case 'Under Review':
        return 60;

      case 'Resolved':
      case 'Rejected':
        return 100;

      default:
        return 0;
    }
  }
}
