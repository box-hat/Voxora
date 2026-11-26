
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CategoryService } from '../../services/category';
import { ConcernService } from '../../services/concern';

interface ConcernCategory {
  id: number;
  name: string;
  description: string;
}

@Component({
  selector: 'app-submit-concern',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './submit-concern.html',
  styleUrl: './submit-concern.css'
})
export class SubmitConcern implements OnInit {

  categories: ConcernCategory[] = [];

  category = '';
  subject = '';
  description = '';

  isSubmitting = false;
  isLoadingCategories = true;

  constructor(
    private router: Router,
    private categoryService: CategoryService,
    private concernService: ConcernService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  // LOAD CATEGORIES FROM MYSQL
  loadCategories(): void {

    this.isLoadingCategories = true;

    this.categoryService.getCategories().subscribe({

      next: (data) => {

        this.categories = data.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description ?? ''
        }));

        this.isLoadingCategories = false;

        console.log('Categories loaded:', this.categories);

        this.cdr.detectChanges();
      },

      error: (error) => {

        console.error('Unable to load categories:', error);

        this.categories = [];
        this.isLoadingCategories = false;

        this.cdr.detectChanges();

        alert('Unable to load categories. Please check the API.');
      }

    });
  }

  // SUBMIT CONCERN TO MYSQL
  submitConcern(): void {

    if (
      !this.category ||
      !this.subject.trim() ||
      !this.description.trim()
    ) {
      return;
    }

    if (this.isSubmitting) return;

    this.isSubmitting = true;

    const concernData = {
      category: this.category,
      subject: this.subject.trim(),
      description: this.description.trim()
    };

    this.concernService.submitConcern(concernData).subscribe({

      next: (response) => {

        console.log('CONCERN SAVED TO MYSQL:', response);

        this.router.navigate(['/submission-success'], {
          queryParams: {
            code: response.trackingCode
          }
        });

      },

      error: (error) => {

        console.error('SUBMISSION ERROR:', error);

        this.isSubmitting = false;

        alert(
          error.error?.message ||
          error.error ||
          'Unable to submit your concern. Please try again.'
        );

      }

    });
  }
}
