import { Injectable, inject, DOCUMENT } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

export interface SeoOptions {
  title: string;
  description: string;
  canonical?: string;
  /** Закрыть от индексации (заглушки страниц с ограниченным доступом). */
  noindex?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly siteUrl = 'https://example.ru';
  private readonly doc = inject(DOCUMENT);

  constructor(
    private title: Title,
    private meta: Meta,
  ) {}

  setSeo(options: SeoOptions): void {
    this.title.setTitle(options.title);
    this.meta.updateTag({ name: 'description', content: options.description });

    const canonical = options.canonical
      ? `${this.siteUrl}${options.canonical}`
      : `${this.siteUrl}/`;
    this.setCanonical(canonical);
    this.setNoindex(!!options.noindex);
    this.meta.updateTag({ property: 'og:title', content: options.title });
    this.meta.updateTag({ property: 'og:description', content: options.description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }

  /** noindex для страниц без публичного доступа. */
  private setNoindex(on: boolean): void {
    const existing = this.doc.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!on) {
      existing?.remove();
      return;
    }
    if (existing) {
      existing.setAttribute('content', 'noindex, nofollow');
      return;
    }
    const meta = this.doc.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex, nofollow');
    this.doc.head.appendChild(meta);
  }

  /** canonical — это <link rel="canonical">; <meta rel="canonical"> поисковики не читают. */
  private setCanonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /** JSON-LD для услуги (Service) или товара (Product). */
  setServiceJsonLd(item: { title: string; description: string; path: string; type?: 'Service' | 'Product' }): void {
    const type = item.type ?? 'Service';
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': type,
      name: item.title,
      description: item.description,
      url: `${this.siteUrl}${item.path}`,
    };
    if (type === 'Service') {
      jsonLd['provider'] = {
        '@type': 'Person',
        name: 'Литвинов Антон',
        telephone: '+7 (938) 026-49-03',
        url: `${this.siteUrl}/about`,
      };
      jsonLd['areaServed'] = 'RU';
      jsonLd['availableLanguage'] = 'ru';
    }
    this.setJsonLd('service-jsonld', jsonLd);
  }

  setFaqJsonLd(faq: { q: string; a: string }[]): void {
    if (!faq.length) {
      return;
    }
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    };
    this.setJsonLd('faq-jsonld', jsonLd);
  }

  private setJsonLd(id: string, data: object): void {
    const existing = this.doc.getElementById(id);
    if (existing) {
      existing.remove();
    }
    const script = this.doc.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    this.doc.head.appendChild(script);
  }
}
