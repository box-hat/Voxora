
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Category {
  id: number;
  name: string;
  description: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  private apiUrl = '/api/categories';

  constructor(private http: HttpClient) {}

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl);
  }

  addCategory(category: {
    name: string;
    description: string;
  }): Observable<any> {
    return this.http.post(this.apiUrl, category);
  }

  updateCategory(
    id: number,
    category: {
      name: string;
      description: string;
    }
  ): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, category);
  }

  deleteCategory(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
