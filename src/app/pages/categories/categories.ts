import { inject } from '@angular/core';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CategoryService } from '../../services/category';
import { AuthService } from '../../services/auth';
import { getErrorMessage } from '../../utils/http-error';

interface ConcernCategory {
  id: number;
  name: string;
  description: string;
}

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './categories.html',
  styleUrl: './categories.css'
})
export class Categories implements OnInit {

  private auth = inject(AuthService);
  private router = inject(Router);

  categories: ConcernCategory[] = [];
  searchTerm = '';

  showModal = false;
  isEditing = false;

  formName = '';
  formDescription = '';

  originalFormName = '';
  originalFormDescription = '';

  editingId: number | null = null;
  isSaving = false;

  constructor(
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  // LOAD CATEGORIES FROM MYSQL
  loadCategories(): void {

    this.categoryService.getCategories().subscribe({
      next: (data) => {

        this.categories = data.map(category => ({
          id: category.id,
          name: category.name,
          description: category.description ?? ''
        }));


        this.cdr.detectChanges();
      },

      error: (error) => {
        alert('Unable to load categories. Please try again later.');
      }
    });
  }

  // SEARCH CATEGORIES
  get filteredCategories(): ConcernCategory[] {
    const search = this.searchTerm.toLowerCase().trim();

    return this.categories.filter(category =>
      category.name.toLowerCase().includes(search) ||
      category.description.toLowerCase().includes(search)
    );
  }

  // OPEN ADD MODAL
  openAddModal(): void {
    this.isEditing = false;
    this.editingId = null;

    this.formName = '';
    this.formDescription = '';

    this.originalFormName = '';
    this.originalFormDescription = '';

    this.showModal = true;
  }

  // OPEN EDIT MODAL
  openEditModal(category: ConcernCategory): void {
    this.isEditing = true;
    this.editingId = category.id;

    this.formName = category.name;
    this.formDescription = category.description;

    // Store original values
    this.originalFormName = category.name;
    this.originalFormDescription = category.description;

    this.showModal = true;
  }

  // CLOSE MODAL
  closeModal(): void {
    if (this.isSaving) return;

    this.showModal = false;

    this.formName = '';
    this.formDescription = '';

    this.originalFormName = '';
    this.originalFormDescription = '';

    this.editingId = null;
  }

  // ADD OR UPDATE CATEGORY
  saveCategory(): void {


    const name = this.formName.trim();
    const description = this.formDescription.trim();

    // VALIDATION
    if (!name || !description) {
      alert('Please complete all fields.');
      return;
    }

    if (this.isSaving) return;

    // CHECK IF THERE ARE CHANGES
    if (
      this.isEditing &&
      name === this.originalFormName.trim() &&
      description === this.originalFormDescription.trim()
    ) {
      alert('No changes detected. Nothing to update.');
      return;
    }

    this.isSaving = true;

    const categoryData = {
      name,
      description
    };

    // UPDATE CATEGORY
    if (this.isEditing && this.editingId !== null) {


      this.categoryService.updateCategory(
        this.editingId,
        categoryData
      ).subscribe({

        next: (response) => {

          this.isSaving = false;
          this.showModal = false;

          this.formName = '';
          this.formDescription = '';

          this.originalFormName = '';
          this.originalFormDescription = '';

          this.editingId = null;

          alert('Category updated successfully!');

          this.loadCategories();
        },

        error: (error) => {

          this.isSaving = false;

          alert(getErrorMessage(error, 'Failed to update category.'));
        }

      });

    } else {

      // ADD NEW CATEGORY

      this.categoryService.addCategory(categoryData).subscribe({

        next: (response) => {

          this.isSaving = false;
          this.showModal = false;

          this.formName = '';
          this.formDescription = '';

          alert('Category added successfully!');

          this.loadCategories();
        },

        error: (error) => {

          this.isSaving = false;

          alert(getErrorMessage(error, 'Failed to add category.'));
        }

      });

    }
  }

  // DELETE CATEGORY
  deleteCategory(category: ConcernCategory): void {

    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) return;


    this.categoryService.deleteCategory(category.id).subscribe({

      next: (response) => {

        alert('Category deleted successfully!');

        this.loadCategories();
      },

      error: (error) => {

        alert(getErrorMessage(error, 'Failed to delete category.'));
      }

    });
  }

  // LOGOUT
  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/admin-login']));
  }

}
