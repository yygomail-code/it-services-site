import { Component, ChangeDetectorRef, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Service, ServiceMediaItem } from '../../models/admin.model';
import { PublicServicesService, servicePriceLabel } from '../../services/public-services.service';
import { SeoService } from '../../services/seo.service';
import { ContentService } from '../../services/content.service';
import { contactHref } from '../../utils/footer.util';
import { LeadFormComponent } from '../../components/lead-form/lead-form.component';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'наличные',
  card: 'карта',
  transfer: 'перевод',
  sbp: 'СБП',
};

/** Тексты раздела карточки: «Услуги» (/services) и «Товары» (/products). */
const SECTION_TEXTS = {
  service: {
    base: '/services',
    label: 'Услуги',
    notFound: 'Услуга не найдена',
    notFoundSeo: 'Услуга не найдена — ИТ-услуги',
    notFoundDescription: 'Услуга не найдена или раздел услуг недоступен.',
    restricted: 'Услуга доступна после входа',
    restrictedSeo: 'Услуга — доступ по ролям',
    restrictedDescription: 'Услуга доступна авторизованным пользователям.',
    back: 'Вернуться к списку услуг',
    seoSuffix: 'ИТ-услуги',
    schemaType: 'Service' as const,
  },
  product: {
    base: '/products',
    label: 'Товары',
    notFound: 'Товар не найден',
    notFoundSeo: 'Товар не найден — товары',
    notFoundDescription: 'Товар не найден или раздел товаров недоступен.',
    restricted: 'Товар доступен после входа',
    restrictedSeo: 'Товар — доступ по ролям',
    restrictedDescription: 'Товар доступен авторизованным пользователям.',
    back: 'Вернуться к списку товаров',
    seoSuffix: 'товары',
    schemaType: 'Product' as const,
  },
};

/** Карточка услуги или товара: галерея, цена, описание, адрес с картой, заявка. */
@Component({
  selector: 'app-service-page',
  imports: [RouterLink, LeadFormComponent],
  templateUrl: './service-page.component.html',
  styleUrl: './service-page.component.scss',
})
export class ServicePageComponent implements OnInit {
  private readonly api = inject(PublicServicesService);
  private readonly seo = inject(SeoService);
  private readonly content = inject(ContentService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);

  /** Раздел из data маршрута: услуга или товар. */
  kind: 'service' | 'product' = 'service';

  loading = true;
  notFound = false;
  restricted = false;
  item: Service | null = null;

  sectionBase = '/services';
  sectionLabel = 'Услуги';
  notFoundTitle = 'Услуга не найдена';
  restrictedTitle = 'Услуга доступна после входа';
  backLabel = 'Вернуться к списку услуг';

  galleryIndex = 0;
  fullOpen = false;
  mapOpen = false;
  mapSrc: SafeResourceUrl | null = null;

  /** Смещение модальной карты (перетаскивание за шапку). */
  mapX = 0;
  mapY = 0;

  ngOnInit(): void {
    this.kind = this.route.snapshot.data['kind'] === 'product' ? 'product' : 'service';
    this.applySection(this.kind);
    this.route.paramMap.subscribe((params) => {
      this.load(params.get('slug') ?? '');
    });
  }

  /** Тексты и пути раздела по типу позиции. */
  private applySection(kind: 'service' | 'product'): void {
    const texts = SECTION_TEXTS[kind];
    this.kind = kind;
    this.sectionBase = texts.base;
    this.sectionLabel = texts.label;
    this.notFoundTitle = texts.notFound;
    this.restrictedTitle = texts.restricted;
    this.backLabel = texts.back;
  }

  private load(slug: string): void {
    this.loading = true;
    this.notFound = false;
    this.restricted = false;
    this.item = null;
    this.galleryIndex = 0;
    this.fullOpen = false;
    this.cdr.markForCheck();

    if (!slug) {
      this.loading = false;
      this.notFound = true;
      this.cdr.markForCheck();
      return;
    }

    this.api.getItem(slug).subscribe((res) => {
      const texts = SECTION_TEXTS[this.kind];
      if (!res) {
        this.notFound = true;
        this.seo.setSeo({
          title: texts.notFoundSeo,
          description: texts.notFoundDescription,
          canonical: `${this.sectionBase}/${slug}`,
          noindex: true,
        });
      } else if (res.restricted) {
        this.restricted = true;
        this.seo.setSeo({
          title: texts.restrictedSeo,
          description: texts.restrictedDescription,
          canonical: `${this.sectionBase}/${slug}`,
          noindex: true,
        });
      } else if (res.item) {
        // Раздел карточки — по типу позиции (товар живёт в /products)
        this.applySection(res.item.kind === 'product' ? 'product' : 'service');
        this.item = res.item;
        this.applySeo(res.item);
      }
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  private applySeo(item: Service): void {
    const texts = SECTION_TEXTS[this.kind];
    const plain = (item.full_description ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    this.seo.setSeo({
      title: item.meta_title || `${item.title} — ${texts.seoSuffix}`,
      description: item.meta_description || item.short_description || plain.slice(0, 200),
      canonical: `${this.sectionBase}/${item.slug}`,
    });
    this.seo.setServiceJsonLd({
      title: item.title,
      description: item.short_description || plain.slice(0, 300),
      path: `${this.sectionBase}/${item.slug}`,
      type: texts.schemaType,
    });
  }

  // ---- Шаблон карточки ----

  /** Включённые поля шаблона в заданном порядке. */
  fields(): string[] {
    return (this.item?.template?.fields ?? []).filter((f) => !!f.on).map((f) => f.key);
  }

  has(key: string): boolean {
    return this.fields().includes(key);
  }

  // ---- Данные ----

  media(): ServiceMediaItem[] {
    return this.item?.media ?? [];
  }

  currentMedia(): string | null {
    return this.media()[this.galleryIndex]?.url ?? null;
  }

  selectMedia(index: number): void {
    this.galleryIndex = index;
    this.cdr.markForCheck();
  }

  nextMedia(): void {
    const count = this.media().length;
    if (count > 0) {
      this.galleryIndex = (this.galleryIndex + 1) % count;
      this.cdr.markForCheck();
    }
  }

  prevMedia(): void {
    const count = this.media().length;
    if (count > 0) {
      this.galleryIndex = (this.galleryIndex - 1 + count) % count;
      this.cdr.markForCheck();
    }
  }

  priceLabel(): string {
    return this.item ? servicePriceLabel(this.item) : '';
  }

  durationLabel(): string | null {
    if (this.item?.unit === 'time' && this.item.duration_min) {
      return `${this.item.duration_min} мин`;
    }
    return null;
  }

  paymentLabels(): string[] {
    return (this.item?.payment_methods ?? [])
      .map((m) => PAYMENT_LABELS[m] ?? m)
      .filter((m) => !!m);
  }

  showMoreButton(): boolean {
    const plain = (this.item?.full_description ?? '').replace(/<[^>]*>/g, ' ').trim();
    return plain.length > 300;
  }

  stars(): string {
    const avg = Math.round(this.item?.rating_avg ?? 0);
    return '★★★★★'.slice(0, avg) + '☆☆☆☆☆'.slice(0, 5 - avg);
  }

  ratingWord(): string {
    return this.plural(this.item?.rating_count ?? 0, 'оценка', 'оценки', 'оценок');
  }

  private plural(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) {
      return one;
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return few;
    }
    return many;
  }

  // ---- Быстрые действия (мобильная панель) ----

  /** Телефон из раздела «Контакты» (подписка на загрузку контента через revision). */
  get phone(): string {
    this.content.revision();
    return this.content.get('contacts.phone', '');
  }

  get phoneHref(): string | null {
    const phone = this.phone;
    return phone ? contactHref('phone', phone) : null;
  }

  /** Прокрутка к форме заявки (якорь #lead-form). */
  scrollToForm(): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.getElementById('lead-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Карта ----

  openMap(): void {
    this.mapOpen = true;
    this.mapSrc = this.sanitizer.bypassSecurityTrustResourceUrl(this.mapUrl());
    this.mapX = 0;
    this.mapY = 0;
    this.cdr.markForCheck();
  }

  closeMap(): void {
    this.mapOpen = false;
    this.mapSrc = null;
    this.cdr.markForCheck();
  }

  mapUrl(): string {
    const s = this.item;
    if (!s) {
      return '';
    }
    if (s.map_lat != null && s.map_lng != null) {
      return `https://yandex.ru/map-widget/v1/?ll=${s.map_lng}%2C${s.map_lat}&z=17&pt=${s.map_lng},${s.map_lat}`;
    }
    return `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(s.address ?? '')}&z=17`;
  }

  mapTransform(): string {
    return `translate(${this.mapX}px, ${this.mapY}px)`;
  }

  startDrag(event: MouseEvent): void {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const baseX = this.mapX;
    const baseY = this.mapY;
    const move = (ev: MouseEvent) => {
      this.mapX = baseX + ev.clientX - startX;
      this.mapY = baseY + ev.clientY - startY;
      this.cdr.markForCheck();
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }
}
