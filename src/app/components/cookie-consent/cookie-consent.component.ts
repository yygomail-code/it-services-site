import { Component, HostBinding, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cookie-consent',
  imports: [RouterLink],
  templateUrl: './cookie-consent.html',
  styleUrl: './cookie-consent.scss',
})
export class CookieConsentComponent implements OnInit {
  @HostBinding('class.cookie-consent--visible') visible = false;

  ngOnInit(): void {
    if (typeof document === 'undefined') {
      return;
    }
    try {
      const consent = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('cookie_consent='));
      if (!consent) {
        setTimeout(() => {
          this.visible = true;
        }, 800);
      }
    } catch {
      this.visible = true;
    }
  }

  accept(): void {
    this.setConsent('accepted');
    this.visible = false;
  }

  decline(): void {
    this.setConsent('declined');
    this.visible = false;
  }

  private setConsent(value: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `cookie_consent=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  }
}
