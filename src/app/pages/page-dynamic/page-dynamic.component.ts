import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { SeoService } from '../../services/seo.service';
import { PageService } from '../../services/page.service';
import { AuthService } from '../../services/auth.service';
import { PageContentComponent } from '../../components/page-content/page-content.component';
import { Page } from '../../models/admin.model';

@Component({
  selector: 'app-page-dynamic',
  imports: [RouterLink, PageContentComponent],
  templateUrl: './page-dynamic.html',
  styleUrl: './page-dynamic.scss',
})
export class PageDynamicComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pages = inject(PageService);
  private readonly auth = inject(AuthService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private sub?: Subscription;

  page: Page | null = null;
  loading = true;
  notFound = false;

  user = this.auth.user;

  /** Куда вернуться после входа (текущий адрес). */
  get returnUrl(): string {
    return this.router.url;
  }

  ngOnInit(): void {
    this.sub = combineLatest([this.route.paramMap, this.route.data]).subscribe(([params, data]) => {
      const slug = (data['slug'] as string | undefined) ?? params.get('slug') ?? '';
      const canonical = (data['canonical'] as string | undefined) ?? `/pages/${slug}`;
      this.loadPage(slug, canonical);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private loadPage(slug: string, canonical: string): void {
    this.loading = true;
    this.notFound = false;
    this.page = null;
    this.cdr.markForCheck();

    if (!slug) {
      this.loading = false;
      this.notFound = true;
      this.cdr.markForCheck();
      return;
    }

    // Страница из БД — контент попадает и в prerender-HTML (роботы видят текст)
    this.pages.getBySlug(slug).subscribe((page) => {
      if (page) {
        this.page = page;
        if (page.restricted) {
          // Доступ закрыт: показываем заглушку, из поиска страницу убираем
          this.seo.setSeo({
            title: page.meta_title || page.title,
            description: page.meta_description || 'Страница доступна ограниченному кругу пользователей.',
            canonical,
            noindex: true,
          });
        } else {
          this.seo.setSeo({
            title: page.meta_title || page.title,
            description:
              page.meta_description ||
              `Страница «${page.title}» — услуги, тексты и материалы исполнителя ИТ-услуг Литвинова Антона.`,
            canonical,
          });
        }
      } else {
        this.notFound = true;
      }
      this.loading = false;
      this.cdr.markForCheck();
    });
  }
}
