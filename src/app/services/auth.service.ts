import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User } from '../models/admin.model';

interface AuthResponse {
  ok: boolean;
  user?: User;
  csrf?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = '/api/auth.php';
  private csrf = '';

  readonly user = signal<User | null>(null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly isManager = computed(() => {
    const role = this.user()?.role;
    return role === 'manager' || role === 'admin';
  });

  constructor(private http: HttpClient) {}

  fetchMe(): Observable<AuthResponse> {
    return this.http
      .get<AuthResponse>(`${this.base}?action=me`, { withCredentials: true })
      .pipe(
        tap((res) => {
          if (res.user) {
            this.user.set(res.user);
          }
          if (res.csrf) {
            this.csrf = res.csrf;
          }
        }),
      );
  }

  login(login: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.base}?action=login`,
        { login, password, csrf: this.csrf },
        { withCredentials: true, headers: this.csrfHeaders() },
      )
      .pipe(
        tap((res) => {
          if (res.user) {
            this.user.set(res.user);
          }
          if (res.csrf) {
            this.csrf = res.csrf;
          }
        }),
      );
  }

  logout(): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.base}?action=logout`,
        { csrf: this.csrf },
        { withCredentials: true, headers: this.csrfHeaders() },
      )
      .pipe(
        tap(() => {
          this.user.set(null);
          this.csrf = '';
        }),
      );
  }

  getCsrf(): string {
    return this.csrf;
  }

  setCsrf(token: string): void {
    this.csrf = token;
  }

  private csrfHeaders(): HttpHeaders {
    return new HttpHeaders({ 'X-CSRF-Token': this.csrf || '' });
  }
}
