import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { ServiceCategory } from '../../models/admin.model';
import { translit } from '../../utils/translit.util';

/** Группы услуг: список, создание, редактирование, порядок, удаление. */
@Component({
  selector: 'app-admin-service-categories',
  imports: [RouterLink],
  templateUrl: './admin-service-categories.html',
  styleUrl: './admin-service-categories.scss',
})
export class AdminServiceCategoriesComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  saving = false;
  error = '';
  saveError = '';

  categories: ServiceCategory[] = [];

  /** Сортировка списка групп: по названию или по количеству позиций. */
  sortMode: 'title' | 'title_desc' | 'count_desc' | 'count_asc' = 'title';
  /** Поиск по названию. */
  filterQ = '';
  /** Фильтр по типу группы: '' — все, 'none' — общие (для всех). */
  filterKind: '' | 'service' | 'product' | 'none' = '';

  formOpen = false;
  editingId = 0;
  formTitle = '';
  formSlug = '';
  formKind: 'service' | 'product' | null = null;
  formSort = 100;
  formActive = true;
  private slugTouched = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.admin.getServiceCategories().subscribe({
      next: (res) => {
        this.categories = res.categories ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить группы';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onSortMode(value: string): void {
    this.sortMode =
      value === 'count_desc'
        ? 'count_desc'
        : value === 'count_asc'
          ? 'count_asc'
          : value === 'title_desc'
            ? 'title_desc'
            : 'title';
    this.cdr.markForCheck();
  }

  onFilterQ(value: string): void {
    this.filterQ = value;
    this.cdr.markForCheck();
  }

  onFilterKind(value: string): void {
    this.filterKind = value === 'service' || value === 'product' || value === 'none' ? value : '';
    this.cdr.markForCheck();
  }

  /** Строки списка после фильтров, в выбранном порядке (по названию — по возрастанию). */
  visibleCategories(): ServiceCategory[] {
    const q = this.filterQ.trim().toLowerCase();
    const items = this.categories.filter((c) => {
      if (this.filterKind === 'service' && c.kind !== 'service') {
        return false;
      }
      if (this.filterKind === 'product' && c.kind !== 'product') {
        return false;
      }
      if (this.filterKind === 'none' && c.kind) {
        return false;
      }
      return !q || c.title.toLowerCase().includes(q);
    });
    if (this.sortMode === 'count_desc') {
      return items.sort(
        (a, b) => (b.services_count ?? 0) - (a.services_count ?? 0) || a.title.localeCompare(b.title, 'ru'),
      );
    }
    if (this.sortMode === 'count_asc') {
      return items.sort(
        (a, b) => (a.services_count ?? 0) - (b.services_count ?? 0) || a.title.localeCompare(b.title, 'ru'),
      );
    }
    if (this.sortMode === 'title_desc') {
      return items.sort((a, b) => b.title.localeCompare(a.title, 'ru'));
    }
    return items.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }

  startCreate(): void {
    this.editingId = 0;
    this.formTitle = '';
    this.formSlug = '';
    this.formKind = null;
    this.slugTouched = false;
    const orders = this.categories.map((c) => Number(c.sort_order));
    this.formSort = orders.length ? Math.max(...orders) + 10 : 100;
    this.formActive = true;
    this.formOpen = true;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  startEdit(category: ServiceCategory): void {
    this.editingId = category.id;
    this.formTitle = category.title;
    this.formSlug = category.slug;
    this.formKind = category.kind ?? null;
    this.formSort = Number(category.sort_order);
    this.formActive = !!category.active;
    this.slugTouched = true;
    this.formOpen = true;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  cancelForm(): void {
    this.formOpen = false;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  onTitle(v: string): void {
    this.formTitle = v;
    if (!this.slugTouched) {
      this.formSlug = translit(v);
    }
    this.cdr.markForCheck();
  }

  onSlug(v: string): void {
    this.formSlug = v.toLowerCase();
    this.slugTouched = true;
    this.cdr.markForCheck();
  }

  save(): void {
    if (this.saving) {
      return;
    }
    if (!this.formTitle.trim()) {
      this.saveError = 'Укажите название группы';
      this.cdr.markForCheck();
      return;
    }
    this.saving = true;
    this.saveError = '';
    this.admin
      .saveServiceCategory({
        id: this.editingId || undefined,
        title: this.formTitle.trim(),
        slug: this.formSlug.trim().toLowerCase(),
        kind: this.formKind,
        sort_order: this.formSort,
        active: this.formActive,
      })
      .subscribe({
        next: (res) => {
          this.saving = false;
          if (res.ok) {
            this.formOpen = false;
            this.load();
          } else {
            this.saveError = res.error ?? 'Не удалось сохранить группу';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err?.error?.error ?? 'Не удалось сохранить группу';
          this.cdr.markForCheck();
        },
      });
  }

  /** Удаление группы: только из формы редактирования, с подтверждением. */
  removeCurrent(): void {
    const category = this.categories.find((c) => c.id === this.editingId);
    if (!category) {
      return;
    }
    if (!confirm(`Удалить группу «${category.title}»?\n\nУслуги и товары останутся, но без группы.`)) {
      return;
    }
    this.admin.deleteServiceCategory(category.id).subscribe({
      next: () => {
        this.formOpen = false;
        this.load();
      },
      error: (err) => {
        this.error = err?.error?.error ?? 'Не удалось удалить группу';
        this.cdr.markForCheck();
      },
    });
  }
}
