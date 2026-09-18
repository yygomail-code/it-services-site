import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminLinkEditorComponent } from '../admin-link-editor/admin-link-editor.component';
import { AdminRolesPickerComponent } from '../admin-roles-picker/admin-roles-picker.component';
import { HeaderConfig, HeaderCta, HeaderMenuItem, LinkTarget, Page, Role } from '../../models/admin.model';
import { AdminService } from '../../services/admin.service';
import { ContentService } from '../../services/content.service';
import { linkUrlError } from '../../utils/footer.util';
import {
  DEFAULT_HEADER_CTA,
  DEFAULT_HEADER_MENU,
  DEFAULT_HEADER_SUBTITLE,
} from '../../utils/header.util';

/** Настройки шапки сайта: подпись у логотипа, меню, кнопка. */
@Component({
  selector: 'app-admin-header',
  imports: [AdminLinkEditorComponent, AdminRolesPickerComponent],
  templateUrl: './admin-header.html',
  styleUrl: './admin-header.scss',
})
export class AdminHeaderComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly content = inject(ContentService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  saving = false;
  saved = false;
  error = '';

  subtitle = '';
  subtitleLarge = false;
  menu: HeaderMenuItem[] = [];
  cta: HeaderCta = { label: '', url: '', roles: null };

  /** Роли из раздела «Роли» — для видимости пунктов. */
  roles: Role[] = [];
  /** Страницы для выбора ссылок из выпадающего списка. */
  pages: Page[] = [];
  /** Разделы, группы и позиции каталога для выбора ссылок. */
  linkTargets: LinkTarget[] = [];

  /** Открытое окно видимости. */
  visibilityOpen = false;
  visibilityTarget: 'menu' | 'cta' = 'menu';
  visibilityIndex = 0;
  visibilitySelected: string[] | null = null;

  ngOnInit(): void {
    this.admin.getRoles().subscribe({
      next: (res) => {
        this.roles = res.roles ?? [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.roles = [];
        this.cdr.markForCheck();
      },
    });
    this.admin.getPages().subscribe({
      next: (res) => {
        this.pages = res.pages;
        this.cdr.markForCheck();
      },
      error: () => {
        this.pages = [];
        this.cdr.markForCheck();
      },
    });
    this.admin.getLinkTargets().subscribe({
      next: (targets) => {
        this.linkTargets = targets;
        this.cdr.markForCheck();
      },
      error: () => {
        this.linkTargets = [];
        this.cdr.markForCheck();
      },
    });
    this.admin.getHeader().subscribe({
      next: (res) => {
        const h = res.header;
        if (h) {
          this.subtitle = h.subtitle ?? '';
          this.subtitleLarge = !!h.subtitle_large;
          this.menu = (h.menu ?? []).map((item) => ({
            label: item.label,
            url: item.url,
            roles: Array.isArray(item.roles) ? [...item.roles] : null,
          }));
          this.cta = h.cta
            ? {
                label: h.cta.label,
                url: h.cta.url,
                roles: Array.isArray(h.cta.roles) ? [...h.cta.roles] : null,
              }
            : { label: '', url: '', roles: null };
        } else {
          // Настройки ещё не сохраняли — показываем текущее меню сайта,
          // чтобы его можно было править, а не заполнять заново
          this.subtitle = DEFAULT_HEADER_SUBTITLE;
          this.menu = DEFAULT_HEADER_MENU.map((item) => ({ ...item }));
          this.cta = { ...DEFAULT_HEADER_CTA };
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить настройки шапки';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ---- Подпись ----
  onSubtitle(value: string): void {
    this.subtitle = value;
    this.cdr.markForCheck();
  }

  toggleSubtitleLarge(v: boolean): void {
    this.subtitleLarge = v;
    this.cdr.markForCheck();
  }

  // ---- Меню ----
  addItem(): void {
    this.menu.push({
      label: '',
      url: '',
      // По умолчанию новый пункт виден всем ролям
      roles: this.roles.map((r) => r.code),
    });
    this.cdr.markForCheck();
  }

  removeItem(index: number): void {
    const item = this.menu[index];
    const name = item?.label?.trim() || 'без названия';
    if (!confirm(`Удалить пункт меню «${name}»?`)) {
      return;
    }
    this.menu.splice(index, 1);
    this.cdr.markForCheck();
  }

  moveItem(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= this.menu.length) {
      return;
    }
    const tmp = this.menu[index];
    this.menu[index] = this.menu[target];
    this.menu[target] = tmp;
    this.cdr.markForCheck();
  }

  // ---- Видимость ----
  openVisibility(target: 'menu' | 'cta', index = 0): void {
    this.visibilityTarget = target;
    this.visibilityIndex = index;
    this.visibilitySelected = this.visibilityItem()?.roles ?? null;
    this.visibilityOpen = true;
    this.cdr.markForCheck();
  }

  applyVisibility(codes: string[]): void {
    const item = this.visibilityItem();
    if (item) {
      item.roles = [...codes];
    }
    this.visibilityOpen = false;
    this.cdr.markForCheck();
  }

  closeVisibility(): void {
    this.visibilityOpen = false;
    this.cdr.markForCheck();
  }

  /** Элемент, для которого открыто окно видимости. */
  private visibilityItem(): { roles?: string[] | null } | null {
    if (this.visibilityTarget === 'cta') {
      return this.cta;
    }
    return this.menu[this.visibilityIndex] ?? null;
  }

  /** Состояние видимости: все роли, часть ролей или скрыто. */
  visibilityLevel(item: { roles?: string[] | null }): 'all' | 'partial' | 'none' {
    const roles = item.roles;
    if (roles === null || roles === undefined) {
      return 'all'; // не задано — видно всем
    }
    if (roles.length === 0) {
      return 'none';
    }
    if (this.roles.length && roles.length >= this.roles.length) {
      return 'all';
    }
    return 'partial';
  }

  /** Подпись кнопки видимости. */
  visibilityTitle(item: { roles?: string[] | null }): string {
    const level = this.visibilityLevel(item);
    if (level === 'none') {
      return 'Скрыто для всех';
    }
    if (level === 'all') {
      return 'Видно всем';
    }
    const titles = (item.roles ?? [])
      .map((code) => this.roles.find((r) => r.code === code)?.title ?? code)
      .join(', ');
    return 'Видно: ' + titles;
  }

  // ---- Сохранение ----
  save(): void {
    if (this.saving) {
      return;
    }
    const linksError = this.linksError();
    if (linksError) {
      this.error = linksError;
      this.cdr.markForCheck();
      return;
    }
    const config: HeaderConfig = {
      subtitle: this.subtitle.trim(),
      subtitle_large: this.subtitleLarge ? 1 : 0,
      menu: this.menu
        .filter((item) => item.label.trim())
        .map((item) => ({
          label: item.label.trim(),
          url: item.url.trim(),
          roles: item.roles ?? null,
        })),
      cta: this.cta.label.trim()
        ? {
            label: this.cta.label.trim(),
            url: this.cta.url.trim(),
            roles: this.cta.roles ?? null,
          }
        : null,
    };

    this.saving = true;
    this.error = '';
    this.saved = false;
    this.admin.saveHeader(config).subscribe({
      next: (res) => {
        this.saving = false;
        if (res.ok) {
          this.saved = true;
          // Обновляем шапку на сайте без перезагрузки
          this.content.loadContent();
          setTimeout(() => {
            this.saved = false;
            this.cdr.markForCheck();
          }, 2500);
        } else {
          this.error = res.error ?? 'Не удалось сохранить';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.error = 'Не удалось сохранить настройки шапки';
        this.cdr.markForCheck();
      },
    });
  }

  /** Первая ошибка в адресах (пусто — всё корректно). */
  private linksError(): string {
    for (const item of this.menu) {
      const err = linkUrlError(item.url);
      if (err) {
        return `Меню, пункт «${item.label.trim() || 'без названия'}»: ${err}`;
      }
    }
    if (this.cta.label.trim()) {
      const ctaError = linkUrlError(this.cta.url);
      if (ctaError) {
        return `Кнопка: ${ctaError}`;
      }
    }
    return '';
  }
}
