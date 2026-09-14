import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ContentMap, Lead, LeadsResponse, User } from '../models/admin.model';

interface ApiResponse<T = unknown> {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  // ---- Лиды -----------------------------------------------------------
  getLeads(params: { page?: number; limit?: number; status?: string; lead_type?: string; q?: string } = {}): Observable<LeadsResponse> {
    let httpParams = new HttpParams();
    if (params.page) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.limit) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params.status && params.status !== 'all') {
      httpParams = httpParams.set('status', params.status);
    }
    if (params.lead_type && params.lead_type !== 'all') {
      httpParams = httpParams.set('lead_type', params.lead_type);
    }
    if (params.q) {
      httpParams = httpParams.set('q', params.q);
    }
    return this.http.get<LeadsResponse>('/api/leads.php', {
      params: httpParams,
      withCredentials: true,
    });
  }

  getLeadsStats(): Observable<{ stats: Record<string, number>; total: number }> {
    return this.http.get<{ stats: Record<string, number>; total: number }>(
      '/api/leads.php?action=stats',
      { withCredentials: true },
    );
  }

  updateLead(id: number, changes: { status?: string; comment?: string }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/leads.php?action=update',
      { id, ...changes, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  deleteLead(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/leads.php?action=delete',
      { id, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  // ---- Контент --------------------------------------------------------
  getContent(): Observable<{ content: ContentMap }> {
    return this.http.get<{ content: ContentMap }>('/api/content.php', { withCredentials: true });
  }

  setContent(key: string, value: string | null): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/content.php?action=set',
      { key, value, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  // ---- Пользователи (admin) ------------------------------------------
  getUsers(): Observable<{ users: User[] }> {
    return this.http.get<{ users: User[] }>('/api/users.php', { withCredentials: true });
  }

  createUser(data: Partial<User> & { password: string }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/users.php?action=create',
      { ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  updateUser(id: number, data: Partial<User> & { password?: string }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/users.php?action=update',
      { id, ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  deleteUser(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/users.php?action=delete',
      { id, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  private csrfHeaders(): Record<string, string> {
    return { 'X-CSRF-Token': this.auth.getCsrf() || '' };
  }
}
