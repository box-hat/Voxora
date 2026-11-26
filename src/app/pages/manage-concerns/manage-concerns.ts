
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  ConcernService,
  AdminConcern
} from '../../services/concern';

@Component({
  selector: 'app-manage-concerns',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './manage-concerns.html',
  styleUrl: './manage-concerns.css'
})
export class ManageConcerns implements OnInit {

  concerns: AdminConcern[] = [];

  searchTerm = '';
  selectedStatus = 'All';

  selectedConcern: AdminConcern | null = null;

  updatedStatus = '';
  adminResponse = '';

  isLoading = false;
  isSaving = false;

  constructor(
    private concernService: ConcernService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadConcerns();
  }

  // LOAD ALL CONCERNS FROM DATABASE
  loadConcerns(): void {
    this.isLoading = true;

    this.concernService.getAllConcerns().subscribe({
      next: data => {
        this.concerns = data;
        this.isLoading = false;

        console.log('CONCERNS LOADED:', data);

        this.cdr.detectChanges();
      },
      error: error => {
        this.isLoading = false;

        console.error('LOAD CONCERNS ERROR:', error);

        alert(
          error.error?.message ||
          error.error ||
          'Unable to load concerns. Please try again.'
        );

        this.cdr.detectChanges();
      }
    });
  }

  // SEARCH AND FILTER
  get filteredConcerns(): AdminConcern[] {
    return this.concerns.filter(concern => {

      const search = this.searchTerm.toLowerCase().trim();

      const matchesSearch =
        concern.trackingCode?.toLowerCase().includes(search) ||
        concern.subject?.toLowerCase().includes(search) ||
        concern.category?.toLowerCase().includes(search);

      const matchesStatus =
        this.selectedStatus === 'All' ||
        concern.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  // OPEN CONCERN DETAILS
  openConcern(concern: AdminConcern): void {
    this.selectedConcern = concern;

    this.updatedStatus = concern.status;

    this.adminResponse = concern.adminResponse || '';
  }

  // CLOSE MODAL
  closeDetails(): void {
    if (this.isSaving) return;

    this.selectedConcern = null;
  }

  // SAVE CHANGES TO DATABASE
  saveChanges(): void {

    if (!this.selectedConcern || this.isSaving) {
      return;
    }

    if (!this.updatedStatus) {
      alert('Please select a status.');
      return;
    }

    this.isSaving = true;

    const trackingCode = this.selectedConcern.trackingCode;

    const updateData = {
      status: this.updatedStatus,
      adminResponse: this.adminResponse.trim()
    };

    this.concernService.updateConcern(
      trackingCode,
      updateData
    ).subscribe({

      next: response => {

        console.log('CONCERN UPDATED:', response);

        this.isSaving = false;
        this.selectedConcern = null;

        alert('Concern successfully updated!');

        this.loadConcerns();

        this.cdr.detectChanges();
      },

      error: error => {

        this.isSaving = false;

        console.error('UPDATE CONCERN ERROR:', error);

        alert(
          error.error?.message ||
          error.error ||
          'Unable to update concern. Please try again.'
        );

        this.cdr.detectChanges();
      }

    });
  }

  // FORMAT DATE
  formatDate(date: string): string {
    return new Date(date).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
