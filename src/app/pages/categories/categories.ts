
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../../services/category';

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
    console.log('Loading categories from MySQL...');

    this.categoryService.getCategories().subscribe({
      next: (data) => {
        console.log('Categories received:', data);

        this.categories = data.map(category => ({
          id: category.id,
          name: category.name,
          description: category.description ?? ''
        }));

        console.log('Total categories:', this.categories.length);

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Failed to load categories:', error);
        alert('Unable to load categories. Please check the API.');
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

    console.log('SAVE CATEGORY BUTTON CLICKED!');

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

      console.log('Sending UPDATE request to API...');

      this.categoryService.updateCategory(
        this.editingId,
        categoryData
      ).subscribe({

        next: (response) => {
          console.log('UPDATE SUCCESS:', response);

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
          console.error('UPDATE ERROR:', error);

          this.isSaving = false;

          alert(
            error.error?.message ||
            error.error ||
            'Failed to update category.'
          );
        }

      });

    } else {

      // ADD NEW CATEGORY
      console.log('Sending POST request to API...');
      console.log('POST DATA:', categoryData);

      this.categoryService.addCategory(categoryData).subscribe({

        next: (response) => {
          console.log('ADD SUCCESS:', response);

          this.isSaving = false;
          this.showModal = false;

          this.formName = '';
          this.formDescription = '';

          alert('Category added successfully!');

          this.loadCategories();
        },

        error: (error) => {
          console.error('ADD ERROR:', error);

          this.isSaving = false;

          alert(
            error.error?.message ||
            error.error ||
            'Failed to add category.'
          );
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

    console.log('Deleting category:', category.id);

    this.categoryService.deleteCategory(category.id).subscribe({

      next: (response) => {
        console.log('DELETE SUCCESS:', response);

        alert('Category deleted successfully!');

        this.loadCategories();
      },

      error: (error) => {
        console.error('DELETE ERROR:', error);

        alert(
          error.error?.message ||
          error.error ||
          'Failed to delete category.'
        );
      }

    });
  }

  // LOGOUT
  logout(): void {
    window.location.href = '/admin-login';
  }

}
