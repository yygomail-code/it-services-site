import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { CookieConsentComponent } from './components/cookie-consent/cookie-consent.component';
import { ContentService } from './services/content.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, CookieConsentComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  constructor(
    private content: ContentService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    // На сервере (SSR/prerender) не делаем HTTP-запросы к API
    if (isPlatformBrowser(this.platformId)) {
      this.content.loadContent();
    }
  }
}
