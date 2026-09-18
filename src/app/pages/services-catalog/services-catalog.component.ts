import { Component, ChangeDetectorRef, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Service, ServiceCategory } from '../../models/admin.model';
import { PublicServicesService } from '../../services/public-services.service';
import { SeoService } from '../../services/seo.service';
import { ServiceCardComponent } from '../../components/service-card/service-card.component';

const PER_PAGE = 15;

/** Тексты раздела: «Услуги» (/services) и «Товары» (/products). */
const SECTION_TEXTS = {
  service: {
    title: 'Услуги',
    lead: 'Выберите, что нужно вашему бизнесу. Не нашли задачу — напишите, обсудим.',
    search: 'Поиск по услугам',
    all: 'Показать все услуги',
    seoTitle: 'Услуги — разработка сайтов, CRM, БД, автоматизация',
    seoDescription:
      'Полный список услуг: разработка и поддержка сайтов, внедрение CRM, базы данных, корпоративный софт, интеграции AI, ускорение сайтов. Удалённо и с выездом.',
    ctaTitle: 'Не знаете, что выбрать?',
    ctaText: 'Расскажите о задаче — помогу определиться и предложу оптимальное решение.',
  },
  product: {
    title: 'Товары',
    lead: 'Готовые решения и цифровые продукты. Не нашли нужное — напишите, подскажу.',
    search: 'Поиск по товарам',
    all: 'Показать все товары',
    seoTitle: 'Товары — готовые решения и цифровые продукты',
    seoDescription:
      'Готовые решения для бизнеса: шаблоны, модули и цифровые продукты. Стоимость, описания и заказ через сайт.',
    ctaTitle: 'Не нашли нужный товар?',
    ctaText: 'Расскажите о задаче — подскажу, что подойдёт, или сделаю под вас.',
  },
} as const;

/** Каталог раздела: фильтры по группам, поиск, 15 позиций на страницу, пагинация. */
@Component({
  selector: 'app-services-catalog',
  imports: [RouterLink, ServiceCardComponent],
  templateUrl: './services-catalog.component.html',
  styleUrl: './services-catalog.component.scss',
})
export class ServicesCatalogComponent implements OnInit, OnDestroy {
  private readonly api = inject(PublicServicesService);
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private sub?: Subscription;
  private searchTimer?: ReturnType<typeof setTimeout>;

  /** Раздел: услуги или товары (из data маршрута). */
  kind: 'service' | 'product' = 'service';
  basePath = '/services';
  sectionTitle = 'Услуги';
  sectionLead = '';
  searchPlaceholder = 'Поиск';
  allLabel = 'Показать все';
  ctaTitle = '';
  ctaText = '';

  loading = true;
  /** Раздел выключен или API недоступен. */
  unavailable = false;
  /** Доступ закрыт по ролям. */
  restricted = false;

  items: Service[] = [];
  categories: ServiceCategory[] = [];
  total = 0;
  page = 1;
  pages = 1;
  perPage = PER_PAGE;

  category = '';
  q = '';
  searchInput = '';
  /** Сортировка: '' (по порядку) | price_asc | price_desc | title | rating. */
  sort = '';

  ngOnInit(): void {
    this.kind = this.route.snapshot.data['kind'] === 'product' ? 'product' : 'service';
    this.basePath = this.kind === 'product' ? '/products' : '/services';
    const texts = SECTION_TEXTS[this.kind];
    this.sectionTitle = texts.title;
    this.sectionLead = texts.lead;
    this.searchPlaceholder = texts.search;
    this.allLabel = texts.all;
    this.ctaTitle = texts.ctaTitle;
    this.ctaText = texts.ctaText;

    this.seo.setSeo({
      title: texts.seoTitle,
      description: texts.seoDescription,
      canonical: this.basePath,
    });

    this.sub = this.route.queryParamMap.subscribe((params) => {
      this.category = params.get('category') ?? '';
      this.q = params.get('q') ?? '';
      this.searchInput = this.q;
      this.sort = params.get('sort') ?? '';
      this.page = Math.max(1, Number(params.get('page')) || 1);
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  private load(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.api
      .getCatalog({
        page: this.page,
        per_page: PER_PAGE,
        category: this.category,
        q: this.q,
        sort: this.sort,
        kind: this.kind,
      })
      .subscribe((res) => {
        if (!res) {
          this.unavailable = true;
          this.restricted = false;
          this.items = [];
          this.categories = [];
          this.seo.setSeo({
            title: `${this.sectionTitle} — раздел временно недоступен`,
            description: 'Раздел временно недоступен.',
            canonical: this.basePath,
            noindex: true,
          });
        } else {
          this.unavailable = false;
          this.restricted = res.restricted;
          this.items = res.items;
          this.categories = res.categories;
          this.total = res.total;
          this.page = res.page;
          this.pages = res.pages;
          this.perPage = res.per_page;
          if (res.restricted) {
            this.seo.setSeo({
              title: `${this.sectionTitle} — доступ по ролям`,
              description: 'Раздел доступен авторизованным пользователям.',
              canonical: this.basePath,
              noindex: true,
            });
          }
        }
        this.loading = false;
        this.cdr.markForCheck();
      });
  }

  /** Живой поиск: запрос уходит через 350 мс после последнего ввода. */
  onSearchInput(value: string): void {
    this.searchInput = value;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.applySearch(), 350);
  }

  /** Enter — применить сразу, не дожидаясь задержки. */
  onSearchSubmit(event: Event): void {
    event.preventDefault();
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.applySearch();
  }

  private applySearch(): void {
    const q = this.searchInput.trim();
    if (q === this.q) {
      return;
    }
    this.router.navigate([this.basePath], {
      queryParams: { q: q || null, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onCategoryChange(value: string): void {
    this.router.navigate([this.basePath], {
      queryParams: { category: value || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  onSortChange(value: string): void {
    this.router.navigate([this.basePath], {
      queryParams: { sort: value || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  /** Сброс всех фильтров раздела (поиск, группа, сортировка). */
  clearFilters(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchInput = '';
    this.router.navigate([this.basePath], {
      queryParams: { q: null, category: null, sort: null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  pageNumbers(): number[] {
    return Array.from({ length: this.pages }, (_, i) => i + 1);
  }

  fromLabel(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.perPage + 1;
  }

  toLabel(): number {
    return Math.min(this.page * this.perPage, this.total);
  }
}
