import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SERVICES } from '../data/services.data';
import { CASES } from '../data/portfolio.data';
import { PARTNER_ROLES } from '../data/partners.data';
import { PartnerRoleInfo, PortfolioCase, Service } from '../models/content.model';

interface ContentResponse {
  content: Record<string, string | null>;
}

@Injectable({ providedIn: 'root' })
export class ContentService {
  private overrides: Record<string, string> = {};

  constructor(private http: HttpClient) {}

  /** Загружает контент из БД (если админ заполнил) и кладёт в overrides. */
  loadContent(): void {
    this.http.get<ContentResponse>('/api/content.php', { withCredentials: true }).subscribe({
      next: (res) => {
        for (const [key, value] of Object.entries(res.content)) {
          if (value !== null && value !== '') {
            this.overrides[key.toLowerCase()] = value;
          }
        }
      },
      error: () => {
        // Не критично — сайт работает со встроенным контентом
      },
    });
  }

  /** Значение по ключу или дефолт. Ключ нечувствителен к регистру. */
  get(key: string, fallback: string): string {
    const normalized = key.toLowerCase();
    return this.overrides[normalized] ?? fallback;
  }

  getServices(): Service[] {
    return SERVICES;
  }

  getService(slug: string): Service | undefined {
    return SERVICES.find((s) => s.slug === slug);
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
