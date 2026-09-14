import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

@Injectable({ providedIn: 'root' })
export class UtmService {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  getUtm(): UtmParams {
    if (!isPlatformBrowser(this.platformId)) {
      return {};
    }
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    const get = (key: string): string | undefined => {
      const value = params.get(key);
      return value && value.trim() ? value.trim().slice(0, 200) : undefined;
    };
    return {
      utm_source: get('utm_source'),
      utm_medium: get('utm_medium'),
      utm_campaign: get('utm_campaign'),
    };
  }
}
