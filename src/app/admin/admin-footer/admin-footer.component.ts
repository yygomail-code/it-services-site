import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { ContentService } from '../../services/content.service';
import {
  FooterAboutRowKey,
  FooterColumn,
  FooterConfig,
  FooterContactField,
  FooterContactItem,
  FooterLink,
  LinkTarget,
  Page,
  Role,
} from '../../models/admin.model';
import { AdminLinkEditorComponent } from '../admin-link-editor/admin-link-editor.component';
import { AdminRolesPickerComponent } from '../admin-roles-picker/admin-roles-picker.component';
import { ContactIconComponent } from '../../components/contact-icon/contact-icon.component';
import {
  FOOTER_CONTACT_FIELDS,
  contactFieldKey,
  contactFieldLabel,
  linkUrlError,
  normalizeFooterContacts,
} from '../../utils/footer.util';

@Component({
  selector: 'app-admin-footer',
  imports: [AdminLinkEditorComponent, AdminRolesPickerComponent, ContactIconComponent],
  templateUrl: './admin-footer.html',
  styleUrl: './admin-footer.scss',
})
export class AdminFooterComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly content = inject(ContentService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  saving = false;
  error = '';
  saved = false;

  /** Описание футера: подпись и примечание (логотип и название — в разделе «Бренд»). */
  aboutSubtitle = '';
  aboutNote = '';
  aboutRows: Record<FooterAboutRowKey, { large: boolean; gap: boolean }> = {
    subtitle: { large: false, gap: false },
    note: { large: false, gap: false },
  };
  aboutRowKeys: FooterAboutRowKey[] = ['subtitle', 'note'];
  columns: FooterColumn[] = [];

  /** Состав и порядок контактов (значения берутся из раздела «Контакты»). */
  contactItems: FooterContactItem[] = [];
  /** Текущие значения контактов из раздела «Контакты» (read-only). */
  contactValues: Record<string, string> = {};

  /** Страницы для выбора ссылок из выпадающего списка. */
  pages: Page[] = [];
  /** Разделы, группы и позиции каталога для выбора ссылок. */
  linkTargets: LinkTarget[] = [];

  /** Роли из раздела «Роли» — для видимости ссылок. */
  roles: Role[] = [];

  /** Открытое окно видимости: колонка и ссылка. */
  visibilityOpen = false;
  visibilityCol = 0;
  visibilityLink = 0;
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
    this.admin.getFooter().subscribe({
      next: (res) => {
        const f = res.footer as unknown as FooterConfig;
        this.aboutSubtitle = f?.about?.subtitle ?? '';
        this.aboutNote = f?.about?.note ?? '';
        for (const key of this.aboutRowKeys) {
          this.aboutRows[key] = {
            large: !!f?.about?.rows?.[key]?.large,
            gap: !!f?.about?.rows?.[key]?.gap,
          };
        }
        this.columns = (f?.columns ?? []).map((c) => ({
          title: c.title,
          links: (c.links ?? []).map((l) => ({
            label: l.label,
            url: l.url,
            large: l.large ? 1 : 0,
            gap: l.gap ? 1 : 0,
            // null — старая запись без ограничений (видна всем)
            roles: Array.isArray(l.roles) ? [...l.roles] : null,
          })),
        }));
        const contacts = normalizeFooterContacts(f?.contacts);
        this.contactItems = contacts.items.map((it) => ({ ...it }));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить настройки футера';
        this.loading = false;
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
    this.admin.getContent().subscribe({
      next: (res) => {
        const values: Record<string, string> = {};
        for (const { field } of FOOTER_CONTACT_FIELDS) {
          values[field] = res.content[contactFieldKey(field)] ?? '';
        }
        this.contactValues = values;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
      },
    });
  }

  // ---- Описание (подпись и примечание) ----
  onAboutSubtitle(v: string): void {
    this.aboutSubtitle = v;
    this.cdr.markForCheck();
  }

  onAboutNote(v: string): void {
    this.aboutNote = v;
    this.cdr.markForCheck();
  }

  toggleAboutRowLarge(key: FooterAboutRowKey, v: boolean): void {
    this.aboutRows[key].large = v;
    this.cdr.markForCheck();
  }

  toggleAboutRowGap(key: FooterAboutRowKey, v: boolean): void {
    this.aboutRows[key].gap = v;
    this.cdr.markForCheck();
  }

  // ---- Колонки ----
  addColumn(): void {
    this.columns.push({ title: '', links: [] });
    this.cdr.markForCheck();
  }

  removeColumn(index: number): void {
    const col = this.columns[index];
    const links = col?.links?.length ?? 0;
    const name = col?.title?.trim() || 'без названия';
    const message = links
      ? `Удалить колонку «${name}» вместе со ссылками (${links})?`
      : `Удалить колонку «${name}»?`;
    if (!confirm(message)) {
      return;
    }
    this.columns.splice(index, 1);
    this.cdr.markForCheck();
  }

  moveColumn(index: number, dir: -1 | 1): void {
    const t = index + dir;
    if (t < 0 || t >= this.columns.length) {
      return;
    }
    const tmp = this.columns[index];
    this.columns[index] = this.columns[t];
    this.columns[t] = tmp;
    this.cdr.markForCheck();
  }

  onColumnTitle(index: number, v: string): void {
    this.columns[index].title = v;
    this.cdr.markForCheck();
  }

  addLink(colIndex: number): void {
    this.columns[colIndex].links.push({
      label: '',
      url: '',
      large: 0,
      gap: 0,
      // По умолчанию новая ссылка видна всем ролям
      roles: this.roles.map((r) => r.code),
    });
    this.cdr.markForCheck();
  }

  removeLink(colIndex: number, linkIndex: number): void {
    const link = this.columns[colIndex]?.links?.[linkIndex];
    const name = link?.label?.trim() || 'без названия';
    if (!confirm(`Удалить ссылку «${name}»?`)) {
      return;
    }
    this.columns[colIndex].links.splice(linkIndex, 1);
    this.cdr.markForCheck();
  }

  moveLink(colIndex: number, linkIndex: number, dir: -1 | 1): void {
    const links = this.columns[colIndex].links;
    const t = linkIndex + dir;
    if (t < 0 || t >= links.length) {
      return;
    }
    const tmp = links[linkIndex];
    links[linkIndex] = links[t];
    links[t] = tmp;
    this.cdr.markForCheck();
  }

  toggleLinkLarge(colIndex: number, linkIndex: number, v: boolean): void {
    this.columns[colIndex].links[linkIndex].large = v ? 1 : 0;
    this.cdr.markForCheck();
  }

  toggleLinkGap(colIndex: number, linkIndex: number, v: boolean): void {
    this.columns[colIndex].links[linkIndex].gap = v ? 1 : 0;
    this.cdr.markForCheck();
  }

  // ---- Видимость ссылки по ролям ----
  openVisibility(colIndex: number, linkIndex: number): void {
    this.visibilityCol = colIndex;
    this.visibilityLink = linkIndex;
    this.visibilitySelected = this.columns[colIndex].links[linkIndex].roles ?? null;
    this.visibilityOpen = true;
    this.cdr.markForCheck();
  }

  applyVisibility(codes: string[]): void {
    this.columns[this.visibilityCol].links[this.visibilityLink].roles = [...codes];
    this.visibilityOpen = false;
    this.cdr.markForCheck();
  }

  closeVisibility(): void {
    this.visibilityOpen = false;
    this.cdr.markForCheck();
  }

  /** Состояние видимости ссылки: все роли, часть ролей или скрыта. */
  visibilityLevel(link: FooterLink): 'all' | 'partial' | 'none' {
    const roles = link.roles;
    if (roles === null || roles === undefined) {
      return 'all'; // старая запись без ограничений
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
  visibilityTitle(link: FooterLink): string {
    const level = this.visibilityLevel(link);
    if (level === 'none') {
      return 'Скрыта для всех';
    }
    if (level === 'all') {
      return 'Видна всем';
    }
    const titles = (link.roles ?? [])
      .map((code) => this.roles.find((r) => r.code === code)?.title ?? code)
      .join(', ');
    return 'Видна: ' + titles;
  }

  // ---- Контакты ----
  toggleContact(index: number, v: boolean): void {
    this.contactItems[index].show = v ? 1 : 0;
    this.cdr.markForCheck();
  }

  toggleContactIcon(index: number, v: boolean): void {
    this.contactItems[index].icon = v ? 1 : 0;
    this.cdr.markForCheck();
  }

  toggleContactLarge(index: number, v: boolean): void {
    this.contactItems[index].large = v ? 1 : 0;
    this.cdr.markForCheck();
  }

  toggleContactGap(index: number, v: boolean): void {
    this.contactItems[index].gap = v ? 1 : 0;
    this.cdr.markForCheck();
  }

  moveContact(index: number, dir: -1 | 1): void {
    const t = index + dir;
    if (t < 0 || t >= this.contactItems.length) {
      return;
    }
    const tmp = this.contactItems[index];
    this.contactItems[index] = this.contactItems[t];
    this.contactItems[t] = tmp;
    this.cdr.markForCheck();
  }

  contactLabel(field: FooterContactField): string {
    return contactFieldLabel(field);
  }

  contactValue(field: FooterContactField): string {
    return this.contactValues[field] ?? '';
  }

  contactKey(field: FooterContactField): string {
    return contactFieldKey(field);
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
    // Отправляем только свои ключи — чтобы не затереть «Подвал» (copyright, bottom_links)
    const config = {
      about: {
        subtitle: this.aboutSubtitle,
        note: this.aboutNote,
        rows: this.aboutRowsConfig(),
      },
      columns: this.columns.map((c) => ({
        title: c.title,
        links: c.links
          .filter((l) => l.label.trim())
          .map((l) => ({
            label: l.label.trim(),
            url: l.url.trim(),
            large: l.large ? 1 : 0,
            gap: l.gap ? 1 : 0,
            roles: l.roles ?? null,
          })),
      })),
      contacts: {
        items: this.contactItems.map((it) => ({
          field: it.field,
          show: it.show ? 1 : 0,
          icon: it.icon ? 1 : 0,
          large: it.large ? 1 : 0,
          gap: it.gap ? 1 : 0,
        })),
      },
    };

    this.saving = true;
    this.error = '';
    this.saved = false;
    this.admin.saveFooter(config).subscribe({
      next: (res) => {
        this.saving = false;
        if (res.ok) {
          this.saved = true;
          // Обновляем футер на сайте без перезагрузки
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
        this.error = 'Не удалось сохранить футер';
        this.cdr.markForCheck();
      },
    });
  }

  trackCol(index: number): number {
    return index;
  }

  /** Первая ошибка в адресах ссылок колонок (пусто — всё корректно). */
  private linksError(): string {
    for (const col of this.columns) {
      for (const link of col.links) {
        const err = linkUrlError(link.url);
        if (err) {
          const where = col.title.trim() ? `Колонка «${col.title.trim()}»` : 'Колонки ссылок';
          return `${where}, ссылка «${link.label.trim() || 'без названия'}»: ${err}`;
        }
      }
    }
    return '';
  }

  /** Настройки строк описания для сохранения: {subtitle: {large, gap}, …}. */
  private aboutRowsConfig(): Record<FooterAboutRowKey, { large: number; gap: number }> {
    const rows = {} as Record<FooterAboutRowKey, { large: number; gap: number }>;
    for (const key of this.aboutRowKeys) {
      rows[key] = {
        large: this.aboutRows[key].large ? 1 : 0,
        gap: this.aboutRows[key].gap ? 1 : 0,
      };
    }
    return rows;
  }
}
