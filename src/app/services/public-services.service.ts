import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Service, ServiceCategory } from '../models/admin.model';
import { API_BASE, apiUrl } from './api.config';

/** Ответ каталога услуг. */
export interface ServiceCatalog {
  restricted: boolean;
  items: Service[];
  categories: ServiceCategory[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

/** Ответ карточки услуги. */
export interface ServiceItemResult {
  restricted: boolean;
  item: Service | null;
}

export interface ServiceCatalogParams {
  page?: number;
  per_page?: number;
  category?: string;
  q?: string;
  kind?: string;
  /** Сортировка: price_asc | price_desc | title | rating (пусто — по порядку). */
  sort?: string;
}

/**
 * Публичный API модуля «Услуги».
 * Возвращает null, если раздел выключен или произошла ошибка (404/сеть).
 * Вызывается и при prerender: каталог попадает в статический HTML.
 */
@Injectable({ providedIn: 'root' })
export class PublicServicesService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE);

  getCatalog(params: ServiceCatalogParams = {}): Observable<ServiceCatalog | null> {
    const query = new URLSearchParams({ action: 'catalog' });
    if (params.page) {
      query.set('page', String(params.page));
    }
    if (params.per_page) {
      query.set('per_page', String(params.per_page));
    }
    if (params.category) {
      query.set('category', params.category);
    }
    if (params.q) {
      query.set('q', params.q);
    }
    if (params.kind) {
      query.set('kind', params.kind);
    }
    if (params.sort) {
      query.set('sort', params.sort);
    }

    return this.http
      .get<{ ok: boolean } & Partial<ServiceCatalog>>(
        apiUrl(this.apiBase, `/api/services.php?${query.toString()}`),
      )
      .pipe(
        map((res) =>
          res.ok
            ? {
                restricted: !!res.restricted,
                items: res.items ?? [],
                categories: res.categories ?? [],
                total: res.total ?? 0,
                page: res.page ?? 1,
                per_page: res.per_page ?? 15,
                pages: res.pages ?? 1,
              }
            : null,
        ),
        catchError(() => of(null)),
      );
  }

  getItem(slug: string): Observable<ServiceItemResult | null> {
    return this.http
      .get<{ ok: boolean; restricted?: boolean; item?: Service | null }>(
        apiUrl(this.apiBase, `/api/services.php?action=item&slug=${encodeURIComponent(slug)}`),
      )
      .pipe(
        map((res) => (res.ok ? { restricted: !!res.restricted, item: res.item ?? null } : null)),
        catchError(() => of(null)),
      );
  }
}

/** Цена услуги строкой: «от 5 000 ₽ в месяц», «по запросу». */
export function servicePriceLabel(service: Service): string {
  if (service.price === null || service.price === undefined) {
    return service.price_note ?? 'по запросу';
  }
  const prefix = service.price_prefix === 'from' ? 'от ' : '';
  const price = new Intl.NumberFormat('ru-RU').format(service.price) + ' ₽';
  return prefix + price + (service.price_note ? ' ' + service.price_note : '');
}
