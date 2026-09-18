import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cookie-consent',
  imports: [RouterLink],
  templateUrl: './cookie-consent.html',
  styleUrl: './cookie-consent.scss',
})
export class CookieConsentComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  visible = false;

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
          this.cdr.detectChanges();
        }, 500);
      }
    } catch {
      this.visible = true;
      this.cdr.detectChanges();
    }
  }

  /** Плашка не закрывается, пока пользователь не нажмёт «Принять». */
  accept(): void {
    this.setConsent('accepted');
    this.visible = false;
    this.cdr.detectChanges();
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
