import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
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
  private readonly isAdmin = signal(false);

  constructor(
    private content: ContentService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Грузим и при prerender: контент из БД попадает в статический HTML
    this.content.loadContent();

    this.isAdmin.set(this.isAdminPath(this.router.url));
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.isAdmin.set(this.isAdminPath(e.urlAfterRedirects)));
  }

  /** На маршрутах админки скрываем шапку/футер/куки-баннер сайта. */
  isAdminRoute(): boolean {
    return this.isAdmin();
  }

  private isAdminPath(url: string): boolean {
    return url.startsWith('/admin');
  }
}
