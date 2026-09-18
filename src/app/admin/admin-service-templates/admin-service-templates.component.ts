import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { CardTemplate, CardTemplateField } from '../../models/admin.model';

/** Все поля карточки: ключ и подпись. */
const CARD_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'gallery', label: 'Галерея (медиа)' },
  { key: 'title', label: 'Название' },
  { key: 'price', label: 'Стоимость' },
  { key: 'rating', label: 'Рейтинг' },
  { key: 'excerpt', label: 'Короткое описание' },
  { key: 'description', label: 'Полное описание' },
  { key: 'address', label: 'Адрес оказания' },
  { key: 'map', label: 'Карта' },
  { key: 'calendar', label: 'Календарь записи' },
  { key: 'comments', label: 'Комментарии' },
];

/** Шаблоны карточек: варианты вёрстки карточки услуги/товара. */
@Component({
  selector: 'app-admin-service-templates',
  imports: [RouterLink],
  templateUrl: './admin-service-templates.html',
  styleUrl: './admin-service-templates.scss',
})
export class AdminServiceTemplatesComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  saving = false;
  error = '';
  saveError = '';

  templates: CardTemplate[] = [];

  /** Поиск, фильтр по типу и сортировка списка. */
  filterQ = '';
  filterKind: '' | 'service' | 'product' = '';
  sortMode: 'title' | 'title_desc' | 'fields_desc' | 'fields_asc' = 'title';

  formOpen = false;
  editingId = 0;
  formName = '';
  formKind: 'service' | 'product' = 'service';
  formDefault = false;
  editFields: CardTemplateField[] = [];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.admin.getCardTemplates().subscribe({
      next: (res) => {
        this.templates = res.templates ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить шаблоны';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  fieldLabel(key: string): string {
    return CARD_FIELDS.find((f) => f.key === key)?.label ?? key;
  }

  onFilterQ(value: string): void {
    this.filterQ = value;
    this.cdr.markForCheck();
  }

  onFilterKind(value: string): void {
    this.filterKind = value === 'service' || value === 'product' ? value : '';
    this.cdr.markForCheck();
  }

  onSortMode(value: string): void {
    this.sortMode =
      value === 'fields_desc'
        ? 'fields_desc'
        : value === 'fields_asc'
          ? 'fields_asc'
          : value === 'title_desc'
            ? 'title_desc'
            : 'title';
    this.cdr.markForCheck();
  }

  /** Строки списка после фильтров, в выбранном порядке (по названию — по возрастанию). */
  visibleTemplates(): CardTemplate[] {
    const q = this.filterQ.trim().toLowerCase();
    const items = this.templates.filter((t) => {
      if (this.filterKind && t.kind !== this.filterKind) {
        return false;
      }
      return !q || t.name.toLowerCase().includes(q);
    });
    if (this.sortMode === 'fields_desc') {
      return items.sort((a, b) => b.fields.length - a.fields.length || a.name.localeCompare(b.name, 'ru'));
    }
    if (this.sortMode === 'fields_asc') {
      return items.sort((a, b) => a.fields.length - b.fields.length || a.name.localeCompare(b.name, 'ru'));
    }
    if (this.sortMode === 'title_desc') {
      return items.sort((a, b) => b.name.localeCompare(a.name, 'ru'));
    }
    return items.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  private normalizeFields(fields: CardTemplateField[]): CardTemplateField[] {
    const known = new Set(CARD_FIELDS.map((f) => f.key));
    const out: CardTemplateField[] = [];
    for (const f of fields) {
      if (known.has(f.key) && !out.some((x) => x.key === f.key)) {
        out.push({ key: f.key, on: !!f.on });
      }
    }
    for (const f of CARD_FIELDS) {
      if (!out.some((x) => x.key === f.key)) {
        out.push({ key: f.key, on: false });
      }
    }
    return out;
  }

  startCreate(): void {
    this.editingId = 0;
    this.formName = '';
    this.formKind = 'service';
    this.formDefault = false;
    this.editFields = this.normalizeFields(CARD_FIELDS.map((f) => ({ key: f.key, on: true })));
    this.formOpen = true;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  startEdit(template: CardTemplate): void {
    this.editingId = template.id;
    this.formName = template.name;
    this.formKind = template.kind === 'product' ? 'product' : 'service';
    this.formDefault = !!template.is_default;
    this.editFields = this.normalizeFields(template.fields ?? []);
    this.formOpen = true;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  cancelForm(): void {
    this.formOpen = false;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  toggleField(key: string, on: boolean): void {
    this.editFields = this.editFields.map((f) => (f.key === key ? { ...f, on } : f));
    this.cdr.markForCheck();
  }

  moveField(index: number, delta: number): void {
    const next = index + delta;
    if (next < 0 || next >= this.editFields.length) {
      return;
    }
    const copy = [...this.editFields];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    this.editFields = copy;
    this.cdr.markForCheck();
  }

  save(): void {
    if (this.saving) {
      return;
    }
    if (!this.formName.trim()) {
      this.saveError = 'Укажите название шаблона';
      this.cdr.markForCheck();
      return;
    }
    this.saving = true;
    this.saveError = '';
    this.admin
      .saveCardTemplate({
        id: this.editingId || undefined,
        name: this.formName.trim(),
        kind: this.formKind,
        fields: this.editFields,
        is_default: this.formDefault,
      })
      .subscribe({
        next: (res) => {
          this.saving = false;
          if (res.ok) {
            this.formOpen = false;
            this.load();
          } else {
            this.saveError = res.error ?? 'Не удалось сохранить шаблон';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.saveError = err?.error?.error ?? 'Не удалось сохранить шаблон';
          this.cdr.markForCheck();
        },
      });
  }

  /** Удаление шаблона: только из редактора, с подтверждением. */
  removeCurrent(): void {
    const template = this.templates.find((t) => t.id === this.editingId);
    if (!template) {
      return;
    }
    if (!confirm(`Удалить шаблон «${template.name}»?\n\nПозиции переключатся на шаблон по умолчанию.`)) {
      return;
    }
    this.admin.deleteCardTemplate(template.id).subscribe({
      next: () => {
        this.formOpen = false;
        this.load();
      },
      error: (err) => {
        this.error = err?.error?.error ?? 'Не удалось удалить шаблон';
        this.cdr.markForCheck();
      },
    });
  }
}
