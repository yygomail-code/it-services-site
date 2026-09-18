import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import {
  CardTemplate,
  Role,
  Service,
  ServiceCategory,
  ServiceMediaItem,
  ServicePaymentMethod,
} from '../../models/admin.model';
import { AdminRolesPickerComponent } from '../admin-roles-picker/admin-roles-picker.component';
import { AdminMediaPickerComponent } from '../admin-media-picker/admin-media-picker.component';
import { translit } from '../../utils/translit.util';

const PAYMENT_METHODS: Array<{ value: ServicePaymentMethod; label: string }> = [
  { value: 'cash', label: 'Наличные' },
  { value: 'card', label: 'Карта' },
  { value: 'transfer', label: 'Перевод' },
  { value: 'sbp', label: 'СБП' },
];

/** Карточка услуги/товара: все настройки, медиа, флаги и доступ. */
@Component({
  selector: 'app-admin-service-edit',
  imports: [RouterLink, AdminRolesPickerComponent, AdminMediaPickerComponent],
  templateUrl: './admin-service-edit.html',
  styleUrl: './admin-service-edit.scss',
})
export class AdminServiceEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly paymentMethods = PAYMENT_METHODS;

  loading = true;
  saving = false;
  error = '';
  saveError = '';
  saved = false;

  isNew = false;
  serviceId = 0;

  categories: ServiceCategory[] = [];
  templates: CardTemplate[] = [];
  roles: Role[] = [];
  rolesPickerOpen = false;
  pickerOpen = false;

  /** Форма позиции. */
  form: Service = {
    id: 0,
    slug: '',
    kind: 'service',
    title: '',
    short_description: '',
    full_description: '',
    price: null,
    price_prefix: 'none',
    price_note: '',
    icon: '',
    unit: 'piece',
    duration_min: 60,
    buffer_before_min: 0,
    buffer_after_min: 0,
    category_id: null,
    template_id: null,
    address: '',
    booking_enabled: false,
    shop_enabled: false,
    comments_enabled: true,
    rating_enabled: true,
    auto_confirm: false,
    prepay: false,
    postpay: true,
    payment_methods: ['cash', 'card', 'transfer', 'sbp'],
    roles: null,
    active: true,
    sort_order: 100,
    meta_title: '',
    meta_description: '',
  };

  media: ServiceMediaItem[] = [];
  private slugTouched = false;

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id') ?? 'new';
    this.isNew = idParam === 'new';

    this.admin.getServiceCategories().subscribe({
      next: (res) => {
        this.categories = res.categories ?? [];
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
    this.admin.getCardTemplates().subscribe({
      next: (res) => {
        this.templates = res.templates ?? [];
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
    this.admin.getRoles().subscribe({
      next: (res) => {
        this.roles = res.roles ?? [];
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });

    if (this.isNew) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.serviceId = Number(idParam) || 0;
    this.admin.getService(this.serviceId).subscribe({
      next: (res) => {
        this.form = { ...this.form, ...res.item };
        this.media = res.item.media ?? [];
        this.slugTouched = true;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить позицию';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ---- Поля ----

  set<K extends keyof Service>(key: K, value: Service[K]): void {
    this.form = { ...this.form, [key]: value };
    if (key === 'title' && !this.slugTouched) {
      this.form.slug = translit(String(value ?? ''));
    }
    if (key === 'kind') {
      // Группа другого типа не подходит — сбрасываем выбор
      const current = this.categories.find((c) => c.id === this.form.category_id);
      if (current?.kind && current.kind !== value) {
        this.form = { ...this.form, category_id: null };
      }
    }
    this.saved = false;
    this.cdr.markForCheck();
  }

  /** Группы для выбора: общие + группы этого типа позиции. */
  categoryOptions(): ServiceCategory[] {
    const kind = this.form.kind;
    return this.categories.filter((c) => !c.kind || c.kind === kind);
  }

  onTitle(v: string): void {
    this.set('title', v);
  }

  onSlug(v: string): void {
    this.slugTouched = true;
    this.set('slug', v.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
  }

  makeSlug(): void {
    this.slugTouched = true;
    this.set('slug', translit(this.form.title));
  }

  onNumber(key: keyof Service, v: string): void {
    const n = Number(v);
    this.set(key, (Number.isFinite(n) ? n : 0) as never);
  }

  onPrice(v: string): void {
    const raw = v.trim();
    this.set('price', raw === '' ? null : (Number(raw.replace(',', '.')) || 0));
  }

  toggleMethod(method: ServicePaymentMethod, on: boolean): void {
    const list = new Set(this.form.payment_methods ?? []);
    if (on) {
      list.add(method);
    } else {
      list.delete(method);
    }
    this.set('payment_methods', [...list]);
  }

  hasMethod(method: ServicePaymentMethod): boolean {
    return (this.form.payment_methods ?? []).includes(method);
  }

  // ---- Медиа ----

  openPicker(): void {
    this.pickerOpen = true;
    this.cdr.markForCheck();
  }

  closePicker(): void {
    this.pickerOpen = false;
    this.cdr.markForCheck();
  }

  onPick(url: string): void {
    this.media = [...this.media, { url, is_cover: this.media.length === 0 }];
    this.pickerOpen = false;
    this.cdr.markForCheck();
  }

  removeMedia(index: number): void {
    const wasCover = !!this.media[index]?.is_cover;
    this.media = this.media.filter((_, i) => i !== index);
    if (wasCover && this.media.length > 0) {
      this.media = this.media.map((m, i) => ({ ...m, is_cover: i === 0 }));
    }
    this.cdr.markForCheck();
  }

  makeCover(index: number): void {
    this.media = this.media.map((m, i) => ({ ...m, is_cover: i === index }));
    this.cdr.markForCheck();
  }

  moveMedia(index: number, delta: number): void {
    const next = index + delta;
    if (next < 0 || next >= this.media.length) {
      return;
    }
    const copy = [...this.media];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    this.media = copy;
    this.cdr.markForCheck();
  }

  // ---- Доступ ----

  openRoles(): void {
    this.rolesPickerOpen = true;
    this.cdr.markForCheck();
  }

  closeRoles(): void {
    this.rolesPickerOpen = false;
    this.cdr.markForCheck();
  }

  applyRoles(codes: string[]): void {
    const all = this.roles.map((r) => r.code);
    this.set('roles', all.length > 0 && codes.length === all.length ? null : codes);
    this.rolesPickerOpen = false;
  }

  rolesLabel(): string {
    const roles = this.form.roles;
    if (roles === null || roles === undefined) {
      return 'всем';
    }
    if (roles.length === 0) {
      return 'никому';
    }
    return roles.map((code) => this.roles.find((r) => r.code === code)?.title ?? code).join(', ');
  }

  // ---- Сохранение ----

  save(): void {
    if (this.saving) {
      return;
    }
    const slug = (this.form.slug ?? '').trim().toLowerCase();
    if (!this.form.title.trim()) {
      this.saveError = 'Укажите название';
      this.cdr.markForCheck();
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{1,127}$/.test(slug)) {
      this.saveError = 'Адрес: латиница, цифры и дефис (например, razrabotka-saitov)';
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.saveError = '';
    this.admin
      .saveService({
        ...this.form,
        id: this.isNew ? undefined : this.serviceId,
        slug,
        media: this.media,
      })
      .subscribe({
        next: (res) => {
          this.saving = false;
          if (res.ok && res.item) {
            this.form = { ...this.form, ...res.item };
            this.media = res.item.media ?? [];
            this.saved = true;
            if (this.isNew) {
              this.isNew = false;
              this.serviceId = res.item.id;
              this.router.navigate(['/admin/services', res.item.id], { replaceUrl: true });
            }
          } else {
            this.saveError = res.error ?? 'Не удалось сохранить позицию';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err?.error?.error ?? 'Не удалось сохранить позицию';
          this.cdr.markForCheck();
        },
      });
  }

  /** Удаление позиции: только из карточки, с подтверждением. */
  remove(): void {
    if (this.isNew || this.saving) {
      return;
    }
    if (!confirm(`Удалить «${this.form.title}»?\n\nПозиция и её галерея будут удалены.`)) {
      return;
    }
    this.admin.deleteService(this.serviceId).subscribe({
      next: (res) => {
        if (res.ok) {
          this.router.navigate(['/admin/services']);
        } else {
          this.saveError = res.error ?? 'Не удалось удалить позицию';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saveError = err?.error?.error ?? 'Не удалось удалить позицию';
        this.cdr.markForCheck();
      },
    });
  }
}
