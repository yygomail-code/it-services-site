import { Component, inject, Input, ChangeDetectorRef } from '@angular/core';
import { FooterLink, LinkTarget, Page } from '../../models/admin.model';
import { pageHref } from '../../utils/page-content.util';
import { linkUrlError } from '../../utils/footer.util';

/**
 * Редактор ссылки: текст + выбор из списка (страницы, разделы, группы и позиции
 * каталога) или ручной URL. Мутирует переданный объект FooterLink напрямую.
 */
@Component({
  selector: 'app-admin-link-editor',
  templateUrl: './admin-link-editor.html',
  styleUrl: './admin-link-editor.scss',
})
export class AdminLinkEditorComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() link!: FooterLink;
  @Input() pages: Page[] = [];
  /** Разделы, группы и позиции каталога для выбора из списка. */
  @Input() catalog: LinkTarget[] = [];

  /** Ошибка формата адреса (пусто — адрес корректен или не задан). */
  error = '';

  onLabel(value: string): void {
    this.link.label = value;
    this.cdr.markForCheck();
  }

  onUrl(value: string): void {
    this.link.url = value;
    this.error = linkUrlError(value);
    this.cdr.markForCheck();
  }

  /** Группы целей в порядке вывода. */
  catalogGroups(): string[] {
    return [...new Set(this.catalog.map((t) => t.group))];
  }

  catalogByGroup(group: string): LinkTarget[] {
    return this.catalog.filter((t) => t.group === group);
  }

  /** Текущее значение селекта: адрес из списка, иначе «вручную». */
  selectedTarget(): string {
    if (this.pages.some((p) => pageHref(p) === this.link.url)) {
      return this.link.url;
    }
    return this.catalog.some((t) => t.url === this.link.url) ? this.link.url : '';
  }

  onTargetSelect(value: string): void {
    if (value === '') {
      return;
    }
    this.link.url = value;
    this.error = linkUrlError(value);
    if (!this.link.label.trim()) {
      const page = this.pages.find((p) => pageHref(p) === value);
      const target = this.catalog.find((t) => t.url === value);
      this.link.label = page?.title ?? target?.label ?? '';
    }
    this.cdr.markForCheck();
  }

  /** Проверить адрес перед сохранением (вызывает родитель). */
  validate(): boolean {
    this.error = linkUrlError(this.link.url);
    this.cdr.markForCheck();
    return this.error === '';
  }

  pageHref = pageHref;
}
