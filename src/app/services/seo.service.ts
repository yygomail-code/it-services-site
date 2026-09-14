import { Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Service } from '../models/content.model';

export interface SeoOptions {
  title: string;
  description: string;
  canonical?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly siteUrl = 'https://example.ru';

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
    this.meta.updateTag({ rel: 'canonical', href: canonical });
    this.meta.updateTag({ property: 'og:title', content: options.title });
    this.meta.updateTag({ property: 'og:description', content: options.description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }

  setServiceJsonLd(service: Service): void {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: service.title,
      description: service.description,
      url: `${this.siteUrl}/services/${service.slug}`,
      provider: {
        '@type': 'Person',
        name: 'Литвинов Антон',
        telephone: '+7 (938) 026-49-03',
        url: `${this.siteUrl}/about`,
      },
      areaServed: 'RU',
      availableLanguage: 'ru',
    };
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
    if (typeof document === 'undefined') {
      return;
    }
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
  }
}
