import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Form } from '../models/admin.model';
import { API_BASE, apiUrl } from './api.config';

@Injectable({ providedIn: 'root' })
export class FormService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE);

  /** Публичная форма для рендера на сайте. */
  getPublicForm(id: number): Observable<{ ok: boolean; form?: Form; error?: string }> {
    return this.http.get<{ ok: boolean; form?: Form; error?: string }>(
      apiUrl(this.apiBase, `/api/forms.php?action=public&id=${id}`),
    );
  }

  /** Отправка данных формы. */
  submit(
    id: number,
    data: Record<string, string>,
    page: string,
    utm?: { utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null },
  ): Observable<{ ok: boolean; error?: string }> {
    return this.http.post<{ ok: boolean; error?: string }>('/api/forms.php?action=submit', {
      id,
      data,
      page,
      utm_source: utm?.utm_source ?? undefined,
      utm_medium: utm?.utm_medium ?? undefined,
      utm_campaign: utm?.utm_campaign ?? undefined,
    });
  }
}
