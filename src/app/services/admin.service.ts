import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { CardTemplate, ContentMap, EmailQueueItem, FooterConfig, Form, FormSubmission, HeaderConfig, Lead, LeadsResponse, LinkTarget, MailPreset, MailService, MediaItem, Page, PageSection, Role, Service, ServiceCategory, ServiceMediaItem, ServiceSectionName, ServiceSections, User } from '../models/admin.model';

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

  // ---- Роли (admin) ---------------------------------------------------
  getRoles(): Observable<{ roles: Role[] }> {
    return this.http.get<{ roles: Role[] }>('/api/roles.php', { withCredentials: true });
  }

  saveRole(data: { id?: number; code: string; title: string; sort_order: number }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/roles.php?action=save',
      { ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  deleteRole(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/roles.php?action=delete',
      { id, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  // ---- Страницы (admin) ----------------------------------------------
  getPages(): Observable<{ pages: Page[] }> {
    return this.http.get<{ pages: Page[] }>('/api/pages.php', { withCredentials: true });
  }

  getPage(id: number): Observable<{ page: Page }> {
    return this.http.get<{ page: Page }>(`/api/pages.php?action=get&id=${id}`, {
      withCredentials: true,
    });
  }

  createPage(data: Partial<Page> & { content: PageSection[] }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/pages.php?action=create',
      { ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  updatePage(id: number, data: Partial<Page> & { content: PageSection[] }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/pages.php?action=update',
      { id, ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  deletePage(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/pages.php?action=delete',
      { id, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  uploadMedia(file: File): Observable<{ id: number; url: string; name: string; size: number } & ApiResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<{ id: number; url: string; name: string; size: number } & ApiResponse>(
      '/api/media.php',
      form,
      { withCredentials: true, headers: { 'X-CSRF-Token': this.auth.getCsrf() || '' } },
    );
  }

  getMedia(): Observable<{ media: MediaItem[] }> {
    return this.http.get<{ media: MediaItem[] }>('/api/media.php', { withCredentials: true });
  }

  deleteMedia(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/media.php?action=delete',
      { id, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  updateMedia(id: number, data: { title?: string | null; alt?: string | null; description?: string | null }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/media.php?action=update',
      { id, ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  // ---- Формы (admin) --------------------------------------------------
  getForms(): Observable<{ forms: Form[] }> {
    return this.http.get<{ forms: Form[] }>('/api/forms.php', { withCredentials: true });
  }

  getForm(id: number): Observable<{ form: Form }> {
    return this.http.get<{ form: Form }>(`/api/forms.php?action=get&id=${id}`, {
      withCredentials: true,
    });
  }

  createForm(data: Partial<Form> & { fields: Form['fields'] }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/forms.php?action=create',
      { ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  updateForm(id: number, data: Partial<Form> & { fields: Form['fields'] }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/forms.php?action=update',
      { id, ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  deleteForm(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/forms.php?action=delete',
      { id, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  getFormSubmissions(id: number): Observable<{ submissions: FormSubmission[] }> {
    return this.http.get<{ submissions: FormSubmission[] }>(
      `/api/forms.php?action=submissions&id=${id}`,
      { withCredentials: true },
    );
  }

  // ---- Футер (admin) -------------------------------------------------
  getFooter(): Observable<{ footer: Record<string, unknown> }> {
    return this.http.get<{ footer: Record<string, unknown> }>('/api/footer.php', {
      withCredentials: true,
    });
  }

  saveFooter(config: Partial<FooterConfig>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/footer.php?action=save',
      { config, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  // ---- Шапка (admin) -------------------------------------------------
  getHeader(): Observable<{ header: HeaderConfig | null }> {
    return this.http.get<{ header: HeaderConfig | null }>('/api/header.php', {
      withCredentials: true,
    });
  }

  saveHeader(config: Partial<HeaderConfig>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/header.php?action=save',
      { config, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  // ---- Почта (admin) -------------------------------------------------
  getMailServices(): Observable<{
    services: MailService[];
    presets: Record<string, MailPreset>;
    purposes: Record<string, string>;
  }> {
    return this.http.get<{
      services: MailService[];
      presets: Record<string, MailPreset>;
      purposes: Record<string, string>;
    }>('/api/mail_services.php', { withCredentials: true });
  }

  saveMailService(service: Partial<MailService> & { password?: string }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/mail_services.php?action=save',
      { ...service, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  deleteMailService(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/mail_services.php?action=delete',
      { id, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  testMailService(id: number, to: string): Observable<ApiResponse & { sent_to?: string }> {
    return this.http.post<ApiResponse & { sent_to?: string }>(
      '/api/mail_services.php?action=test',
      { id, to, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  getEmailQueue(): Observable<{ queue: EmailQueueItem[]; counts: Record<string, number> }> {
    return this.http.get<{ queue: EmailQueueItem[]; counts: Record<string, number> }>(
      '/api/mail_services.php?action=queue',
      { withCredentials: true },
    );
  }

  processEmailQueue(): Observable<ApiResponse & { sent?: number; failed?: number; left?: number }> {
    return this.http.post<ApiResponse & { sent?: number; failed?: number; left?: number }>(
      '/api/mail_services.php?action=queue_process',
      { csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

      retryEmailQueueItem(id: number): Observable<ApiResponse & { sent?: boolean }> {
        return this.http.post<ApiResponse & { sent?: boolean }>(
          '/api/mail_services.php?action=queue_retry',
          { id, csrf: this.auth.getCsrf() },
          { withCredentials: true, headers: this.csrfHeaders() },
        );
      }

      getCronLink(): Observable<{ has_key: boolean; link: string | null }> {
        return this.http.get<{ has_key: boolean; link: string | null }>(
          '/api/mail_services.php?action=cron_link',
          { withCredentials: true },
        );
      }

      generateCronLink(): Observable<ApiResponse & { has_key?: boolean; link?: string }> {
        return this.http.post<ApiResponse & { has_key?: boolean; link?: string }>(
          '/api/mail_services.php?action=cron_link_generate',
          { csrf: this.auth.getCsrf() },
          { withCredentials: true, headers: this.csrfHeaders() },
        );
      }

      deleteCronLink(): Observable<ApiResponse & { has_key?: boolean }> {
        return this.http.post<ApiResponse & { has_key?: boolean }>(
          '/api/mail_services.php?action=cron_link_delete',
          { csrf: this.auth.getCsrf() },
          { withCredentials: true, headers: this.csrfHeaders() },
        );
      }

  // ---- Услуги (admin) --------------------------------------------------

  getServices(
    params: { q?: string; kind?: string; category?: number; page?: number; per_page?: number } = {},
  ): Observable<{ items: Service[]; total?: number; page?: number; per_page?: number; pages?: number }> {
    const query = new URLSearchParams({ action: 'admin_list' });
    if (params.q) {
      query.set('q', params.q);
    }
    if (params.kind) {
      query.set('kind', params.kind);
    }
    if (params.category) {
      query.set('category', String(params.category));
    }
    if (params.page) {
      query.set('page', String(params.page));
    }
    if (params.per_page) {
      query.set('per_page', String(params.per_page));
    }
    return this.http.get<{ items: Service[]; total?: number; page?: number; per_page?: number; pages?: number }>(
      `/api/services.php?${query.toString()}`,
      { withCredentials: true },
    );
  }

  getService(id: number): Observable<{ item: Service }> {
    return this.http.get<{ item: Service }>(`/api/services.php?action=admin_item&id=${id}`, {
      withCredentials: true,
    });
  }

  saveService(data: Partial<Service> & { media?: ServiceMediaItem[] }): Observable<ApiResponse & { item?: Service }> {
    return this.http.post<ApiResponse & { item?: Service }>(
      '/api/services.php?action=save',
      { ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  deleteService(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/services.php?action=delete',
      { id, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  getServiceCategories(): Observable<{ categories: ServiceCategory[] }> {
    return this.http.get<{ categories: ServiceCategory[] }>('/api/services.php?action=categories_admin', {
      withCredentials: true,
    });
  }

  saveServiceCategory(data: Partial<ServiceCategory>): Observable<ApiResponse & { id?: number }> {
    return this.http.post<ApiResponse & { id?: number }>(
      '/api/services.php?action=category_save',
      { ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  deleteServiceCategory(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/services.php?action=category_delete',
      { id, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  getCardTemplates(): Observable<{ templates: CardTemplate[] }> {
    return this.http.get<{ templates: CardTemplate[] }>('/api/services.php?action=templates', {
      withCredentials: true,
    });
  }

  saveCardTemplate(data: Partial<CardTemplate>): Observable<ApiResponse & { id?: number }> {
    return this.http.post<ApiResponse & { id?: number }>(
      '/api/services.php?action=template_save',
      { ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  deleteCardTemplate(id: number): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      '/api/services.php?action=template_delete',
      { id, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  /** Настройки разделов «Услуги» и «Товары» (видимость на сайте + доступ по ролям). */
  getServiceSections(): Observable<{ sections: ServiceSections }> {
    return this.http.get<{ sections: ServiceSections }>('/api/services.php?action=section', {
      withCredentials: true,
    });
  }

  saveServiceSection(
    name: ServiceSectionName,
    data: { enabled: boolean; roles: string[] | null },
  ): Observable<ApiResponse & { sections?: ServiceSections }> {
    return this.http.post<ApiResponse & { sections?: ServiceSections }>(
      '/api/services.php?action=section_save',
      { name, ...data, csrf: this.auth.getCsrf() },
      { withCredentials: true, headers: this.csrfHeaders() },
    );
  }

  private csrfHeaders(): Record<string, string> {
    return { 'X-CSRF-Token': this.auth.getCsrf() || '' };
  }

  /**
   * Цели ссылок для меню и футера: разделы, группы и позиции каталога.
   * Редактор ссылок показывает их списком, чтобы адрес не вводили вручную.
   */
  getLinkTargets(): Observable<LinkTarget[]> {
    return forkJoin({
      categories: this.getServiceCategories(),
      services: this.getServices({ per_page: 200 }),
    }).pipe(
      map(({ categories, services }) => {
        const cats = categories.categories ?? [];
        const items = services.items ?? [];
        const targets: LinkTarget[] = [
          { group: 'Разделы', label: 'Услуги', url: '/services' },
          { group: 'Разделы', label: 'Товары', url: '/products' },
        ];
        for (const c of cats) {
          if (c.kind !== 'product') {
            targets.push({ group: 'Группы услуг', label: c.title, url: `/services?category=${c.slug}` });
          }
        }
        for (const s of items) {
          if (s.kind !== 'product') {
            targets.push({ group: 'Услуги', label: s.title, url: `/services/${s.slug}` });
          }
        }
        for (const c of cats) {
          if (c.kind !== 'service') {
            targets.push({ group: 'Группы товаров', label: c.title, url: `/products?category=${c.slug}` });
          }
        }
        for (const s of items) {
          if (s.kind === 'product') {
            targets.push({ group: 'Товары', label: s.title, url: `/products/${s.slug}` });
          }
        }
        return targets;
      }),
      catchError(() => of([])),
    );
  }
}
