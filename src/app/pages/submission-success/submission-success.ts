
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-submission-success',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './submission-success.html',
  styleUrl: './submission-success.css'
})
export class SubmissionSuccess implements OnInit {
  trackingCode = '';
  copied = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.trackingCode = params.get('code') || '';
    });
  }

  async copyTrackingCode(): Promise<void> {
    if (!this.trackingCode) return;

    try {
      await navigator.clipboard.writeText(this.trackingCode);
      this.copied = true;
    } catch {
      this.copied = false;
    }
  }
}
