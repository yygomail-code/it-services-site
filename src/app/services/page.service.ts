import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Page } from '../models/admin.model';
import { API_BASE, apiUrl } from './api.config';

@Injectable({ providedIn: 'root' })
export class PageService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE);

  /**
   * Возвращает опубликованную страницу из БД или null (404/черновик/ошибка).
   * Вызывается и при prerender: контент страницы попадает в статический HTML.
   */
  getBySlug(slug: string): Observable<Page | null> {
    return this.http
      .get<{ ok: boolean; page?: Page; error?: string }>(
        apiUrl(this.apiBase, `/api/pages.php?action=public&slug=${encodeURIComponent(slug)}`),
      )
      .pipe(
        map((res) => (res.ok && res.page ? res.page : null)),
        catchError(() => of(null)),
      );
  }
}
