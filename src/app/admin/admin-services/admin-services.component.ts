import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { Role, Service, ServiceCategory, ServiceSectionName, ServiceSections } from '../../models/admin.model';
import { AdminRolesPickerComponent } from '../admin-roles-picker/admin-roles-picker.component';

/** Каталог: список услуг и товаров, фильтры и настройки разделов. */
@Component({
  selector: 'app-admin-services',
  imports: [RouterLink, AdminRolesPickerComponent],
  templateUrl: './admin-services.html',
  styleUrl: './admin-services.scss',
})
export class AdminServicesComponent implements OnInit, OnDestroy {
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Таймер живой фильтрации по поиску. */
  private searchTimer?: ReturnType<typeof setTimeout>;

  loading = true;
  error = '';
  savingSection: ServiceSectionName | null = null;
  savedSection: ServiceSectionName | null = null;

  items: Service[] = [];
  categories: ServiceCategory[] = [];
  roles: Role[] = [];
  sections: ServiceSections = {
    services: { enabled: true, roles: null },
    products: { enabled: false, roles: null },
  };
  rolesPickerFor: ServiceSectionName | null = null;

  /** Карточки разделов в шапке: подписи и порядок. */
  readonly sectionCards: Array<{ name: ServiceSectionName; label: string }> = [
    { name: 'services', label: 'Услуги' },
    { name: 'products', label: 'Товары' },
  ];

  filterQ = '';
  filterKind = '';
  filterCategory = 0;

  /** Пагинация списка: 50 строк на страницу по умолчанию. */
  total = 0;
  page = 1;
  pages = 1;
  perPage = 50;
  readonly pageSizeOptions = [25, 50, 100, 200];

  ngOnInit(): void {
    this.admin.getRoles().subscribe({
      next: (res) => {
        this.roles = res.roles ?? [];
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
    this.admin.getServiceSections().subscribe({
      next: (res) => {
        if (res.sections) {
          this.sections = res.sections;
        }
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
    this.loadCategories();
    this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.admin
      .getServices({
        q: this.filterQ.trim(),
        kind: this.filterKind,
        category: this.filterCategory,
        page: this.page,
        per_page: this.perPage,
      })
      .subscribe({
        next: (res) => {
          this.items = res.items ?? [];
          this.total = res.total ?? this.items.length;
          this.page = res.page ?? 1;
          this.pages = res.pages ?? 1;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'Не удалось загрузить каталог';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  loadCategories(): void {
    this.admin.getServiceCategories().subscribe({
      next: (res) => {
        this.categories = res.categories ?? [];
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  onFilterQ(v: string): void {
    this.filterQ = v;
    this.cdr.markForCheck();
    // Живой поиск: перезапрашиваем список с небольшой задержкой
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = undefined;
      this.page = 1;
      this.load();
    }, 350);
  }

  onFilterKind(v: string): void {
    this.filterKind = v;
    // Выбранная группа может не подходить новому типу — сбрасываем
    if (!this.categoryFilterOptions().some((c) => c.id === this.filterCategory)) {
      this.filterCategory = 0;
    }
    this.page = 1;
    this.load();
  }

  onFilterCategory(v: string): void {
    this.filterCategory = Number(v) || 0;
    this.page = 1;
    this.load();
  }

  /** Группы для фильтра списка: подходят выбранному типу (или все, если тип не выбран). */
  categoryFilterOptions(): ServiceCategory[] {
    if (this.filterKind !== 'service' && this.filterKind !== 'product') {
      return this.categories;
    }
    return this.categories.filter((c) => !c.kind || c.kind === this.filterKind);
  }

  // ---- Пагинация ----

  setPage(page: number): void {
    if (page < 1 || page > this.pages || page === this.page) {
      return;
    }
    this.page = page;
    this.load();
  }

  setPerPage(value: string): void {
    this.perPage = Number(value) || 50;
    this.page = 1;
    this.load();
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

  // ---- Настройки разделов ----

  toggleSection(name: ServiceSectionName, on: boolean): void {
    this.sections = { ...this.sections, [name]: { ...this.sections[name], enabled: on } };
    this.savedSection = null;
    this.cdr.markForCheck();
  }

  openRoles(name: ServiceSectionName): void {
    this.rolesPickerFor = name;
    this.cdr.markForCheck();
  }

  /** Текущий раздел для пикера ролей (null — пикер закрыт). */
  rolesPickerSection(): { roles: string[] | null } | null {
    return this.rolesPickerFor ? this.sections[this.rolesPickerFor] : null;
  }

  applyRoles(codes: string[]): void {
    const name = this.rolesPickerFor;
    if (!name) {
      return;
    }
    const all = this.roles.map((r) => r.code);
    const roles = all.length > 0 && codes.length === all.length ? null : codes;
    this.sections = { ...this.sections, [name]: { ...this.sections[name], roles } };
    this.rolesPickerFor = null;
    this.saveSection(name);
  }

  closeRoles(): void {
    this.rolesPickerFor = null;
    this.cdr.markForCheck();
  }

  saveSection(name: ServiceSectionName): void {
    if (this.savingSection) {
      return;
    }
    const section = this.sections[name];
    this.savingSection = name;
    this.savedSection = null;
    this.admin.saveServiceSection(name, { enabled: section.enabled, roles: section.roles }).subscribe({
      next: (res) => {
        this.savingSection = null;
        if (res.sections) {
          this.sections = res.sections;
        }
        this.savedSection = name;
        this.cdr.markForCheck();
      },
      error: () => {
        this.savingSection = null;
        this.error = 'Не удалось сохранить настройки раздела';
        this.cdr.markForCheck();
      },
    });
  }

  // ---- Список ----

  rolesLabel(name: ServiceSectionName): string {
    const roles = this.sections[name].roles;
    if (roles === null) {
      return 'всем';
    }
    if (roles.length === 0) {
      return 'никому';
    }
    return roles.map((code) => this.roles.find((r) => r.code === code)?.title ?? code).join(', ');
  }

  priceLabel(item: Service): string {
    if (item.price === null || item.price === undefined) {
      return item.price_note ?? 'по запросу';
    }
    const prefix = item.price_prefix === 'from' ? 'от ' : '';
    const price = new Intl.NumberFormat('ru-RU').format(item.price) + ' ₽';
    return prefix + price + (item.price_note ? ' ' + item.price_note : '');
  }
}
