
import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {

  private requestSubject =
    new Subject<ConfirmationOptions | null>();

  readonly request$: Observable<ConfirmationOptions | null> =
    this.requestSubject.asObservable();

  private resolver?: (confirmed: boolean) => void;

  confirm(options: ConfirmationOptions): Promise<boolean> {

    if (this.resolver) {
      this.resolver(false);
    }

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.requestSubject.next(options);
    });
  }

  close(confirmed: boolean): void {
    this.requestSubject.next(null);

    const resolve = this.resolver;
    this.resolver = undefined;

    resolve?.(confirmed);
  }
}
