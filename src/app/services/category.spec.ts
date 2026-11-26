import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CategoryService } from './category';

describe('CategoryService', () => {
  let service: CategoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CategoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads categories from the relative API URL', () => {
    let names: string[] = [];
    service.getCategories().subscribe(list => (names = list.map(c => c.name)));

    http.expectOne('/api/categories').flush([{ id: 1, name: 'Academic', description: null }]);

    expect(names).toEqual(['Academic']);
  });
});
