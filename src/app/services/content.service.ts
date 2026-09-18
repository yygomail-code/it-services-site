import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CASES } from '../data/portfolio.data';
import { PARTNER_ROLES } from '../data/partners.data';
import { PartnerRoleInfo, PortfolioCase } from '../models/content.model';
import { Brand, FooterConfig, HeaderConfig } from '../models/admin.model';
import { DEFAULT_BRAND_NAME, normalizeFooterContacts } from '../utils/footer.util';
import { API_BASE, apiUrl } from './api.config';

interface ContentResponse {
  content: Record<string, string | null>;
}

/**
 * Контент, загруженный до bootstrap (см. src/main.ts).
 * Нужен, чтобы первый рендер на клиенте совпал с prerender-HTML: иначе
 * гидратация видит другой список меню/ссылок и пропускает компоненты.
 */
let preloadedContent: Record<string, string | null> | null = null;

export function setPreloadedContent(content: Record<string, string | null>): void {
  preloadedContent = content;
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE);

  private overrides: Record<string, string> = {};

  /** Становится true после загрузки контента из БД (успех или ошибка). */
  readonly ready = signal(false);
  /** Увеличивается при каждом обновлении контента — сигнал для перерисовки. */
  readonly revision = signal(0);

  /** Загружает контент из БД (если админ заполнил) и кладёт в overrides. */
  loadContent(): void {
    // Контент, загруженный до старта приложения, применяем без запроса
    if (preloadedContent) {
      const preload = preloadedContent;
      preloadedContent = null;
      this.applyContent(preload);
      return;
    }
    this.http
      .get<ContentResponse>(apiUrl(this.apiBase, '/api/content.php'), { withCredentials: true })
      .subscribe({
        next: (res) => this.applyContent(res.content),
        error: () => {
          // Не критично — сайт работает со встроенным контентом
          this.ready.set(true);
          this.revision.update((v) => v + 1);
        },
      });
  }

  /** Раскладывает значения по ключам (без пустых) и сообщает об обновлении. */
  private applyContent(content: Record<string, string | null>): void {
    const overrides: Record<string, string> = {};
    for (const [key, value] of Object.entries(content)) {
      if (value !== null && value !== '') {
        overrides[key.toLowerCase()] = value;
      }
    }
    // Полная замена: удалённые значения не должны оставаться в кэше
    this.overrides = overrides;
    this.ready.set(true);
    this.revision.update((v) => v + 1);
  }

  /** Значение по ключу или дефолт. Ключ нечувствителен к регистру. */
  get(key: string, fallback: string): string {
    const normalized = key.toLowerCase();
    return this.overrides[normalized] ?? fallback;
  }

  /** JSON-значение по ключу или null. */
  getJson<T>(key: string): T | null {
    const raw = this.overrides[key.toLowerCase()];
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** Конфигурация футера (если админ заполнил). */
  getFooter(): FooterConfig | null {
    // footer.about — текущий ключ; footer.logo — прошлая версия блока
    const about =
      this.getJson<FooterConfig['about']>('footer.about') ??
      this.getJson<FooterConfig['about']>('footer.logo');
    const columns = this.getJson<FooterConfig['columns']>('footer.columns');
    const contacts = this.getJson<FooterConfig['contacts']>('footer.contacts');
    const copyright = this.getJson<FooterConfig['copyright']>('footer.copyright');
    const bottomLinks = this.getJson<FooterConfig['bottom_links']>('footer.bottom_links');
    if (!about && !columns && !contacts && !copyright && !bottomLinks) {
      return null;
    }
    return {
      about: about ?? { subtitle: '', note: '' },
      columns: columns ?? [],
      contacts: normalizeFooterContacts(contacts),
      copyright: copyright ?? null,
      bottom_links: bottomLinks ?? [],
    };
  }

  /** Настройки шапки сайта (если админ заполнил). */
  getHeader(): HeaderConfig | null {
    const config = this.getJson<HeaderConfig>('header.config');
    if (!config) {
      return null;
    }
    return {
      subtitle: config.subtitle ?? '',
      subtitle_large: config.subtitle_large ?? 0,
      menu: Array.isArray(config.menu) ? config.menu : [],
      cta: config.cta ?? null,
    };
  }

  /** Единый бренд сайта: логотип, название, метка. */
  getBrand(): Brand {
    return {
      name: this.get('brand.name', DEFAULT_BRAND_NAME),
      mark: this.get('brand.mark', ''),
      logo: this.get('brand.logo', ''),
    };
  }

  getCases(): PortfolioCase[] {
    return CASES;
  }

  getCase(slug: string): PortfolioCase | undefined {
    return CASES.find((c) => c.slug === slug);
  }

  getPartnerRoles(): PartnerRoleInfo[] {
    return PARTNER_ROLES;
  }
}
