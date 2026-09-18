import { Component, inject, ChangeDetectorRef, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ContentService } from '../../services/content.service';
import {
  FooterAboutRowKey,
  FooterColumn,
  FooterConfig,
  FooterContactField,
  FooterLink,
} from '../../models/admin.model';
import {
  brandMark,
  contactDisplayValue,
  contactFieldKey,
  contactFieldLabel,
  contactHref,
} from '../../utils/footer.util';
import { ContactIconComponent } from '../contact-icon/contact-icon.component';

export interface FooterContactRow {
  field: FooterContactField;
  label: string;
  value: string;
  href: string | null;
  icon: boolean;
  large: boolean;
  gap: boolean;
}

@Component({
  selector: 'app-footer',
  imports: [RouterLink, ContactIconComponent],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class FooterComponent {
  private readonly content = inject(ContentService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  // Текущий конфиг из админки (если задан)
  footer: FooterConfig | null = null;

  constructor() {
    effect(() => {
      if (this.content.ready()) {
        // revision меняется после сохранения настроек — обновляем футер сразу
        this.content.revision();
        // роль пользователя влияет на видимость ссылок (и готовность сессии)
        this.auth.user();
        this.auth.ready();
        this.footer = this.content.getFooter();
        this.cdr.markForCheck();
      }
    });
  }

  // ---- Бренд (единый для сайта: раздел «Бренд») ----
  get brandName(): string {
    return this.content.getBrand().name;
  }

  /** Логотип из медиатеки. Пусто — показываем метку. */
  get brandLogo(): string {
    return this.content.getBrand().logo;
  }

  /** Метка: из настроек, иначе первая буква названия, иначе «А». */
  get brandMark(): string {
    const brand = this.content.getBrand();
    return brandMark(brand.mark, brand.name);
  }

  // ---- Описание футера (подпись и примечание — свои у секции) ----
  // Если футер настроен в админке, показываем только заполненные строки;
  // встроенные тексты — для сайта без настроек.
  get aboutSubtitle(): string {
    if (this.footer) {
      return this.footer.about?.subtitle ?? '';
    }
    return 'ИТ-услуги: сайты, CRM, БД, автоматизация';
  }

  get aboutNote(): string {
    if (this.footer) {
      return this.footer.about?.note ?? '';
    }
    return 'Работаю удалённо по всей России, возможен выезд к заказчику.';
  }

  aboutRowLarge(key: FooterAboutRowKey): boolean {
    const large = this.footer?.about?.rows?.[key]?.large;
    return large !== 0 && !!large;
  }

  aboutRowGap(key: FooterAboutRowKey): boolean {
    const gap = this.footer?.about?.rows?.[key]?.gap;
    return gap !== 0 && !!gap;
  }

  // ---- Колонки ----
  get columns(): FooterColumn[] {
    return (this.footer?.columns ?? []).map((col) => ({
      title: col.title,
      // Ссылки без адреса на сайте не показываем
      links: (col.links ?? []).filter(
        (link) => this.linkVisible(link) && !!link.label?.trim() && !!link.url?.trim(),
      ),
    }));
  }

  /** Колонки, в которых есть что показать (пустые не рендерятся). */
  get visibleColumns(): FooterColumn[] {
    return this.columns.filter((col) => col.links.length > 0);
  }

  /**
   * Видимость ссылки по ролям.
   * Не задано — видна всем (старые записи), пустой список — скрыта для всех.
   * До проверки сессии ссылки с ограничениями не показываем, иначе при загрузке
   * мелькают ссылки, закрытые для роли пользователя.
   */
  linkVisible(link: FooterLink): boolean {
    const roles = link.roles;
    if (roles === null || roles === undefined) {
      return true;
    }
    if (roles.length === 0 || !this.auth.ready()) {
      return false;
    }
    const role = this.auth.user()?.role ?? 'guest';
    return roles.includes(role);
  }

  /** Классы строки-ссылки: «крупнее» и «отступ сверху». */
  linkClasses(link: FooterLink): Record<string, boolean> {
    return {
      'footer__link--large': link.large !== 0 && !!link.large,
      'footer__link--gap': link.gap !== 0 && !!link.gap,
    };
  }

  // ---- Контакты (значения — из раздела «Контакты», состав/порядок — из футера) ----
  get contactRows(): FooterContactRow[] {
    const contacts = this.footer?.contacts;
    if (!contacts) {
      return [];
    }
    const rows: FooterContactRow[] = [];
    for (const item of contacts.items) {
      if (item.show === 0 || item.show === false) {
        continue;
      }
      const value = this.content.get(contactFieldKey(item.field), '');
      if (!value) {
        continue;
      }
      rows.push({
        field: item.field,
        label: contactFieldLabel(item.field),
        value: contactDisplayValue(item.field, value),
        href: contactHref(item.field, value),
        icon: item.icon !== 0 && item.icon !== false,
        large: item.large !== 0 && item.large !== false,
        gap: item.gap !== 0 && item.gap !== false,
      });
    }
    return rows;
  }

  // ---- Подвал ----
  get copyrightText(): string {
    if (this.footer?.copyright) {
      return this.footer.copyright.text ?? '';
    }
    return '© 2026 Литвинов Антон. Все права защищены.';
  }

  /** Показываем копирайт, только если заполнен текст. */
  get showCopyright(): boolean {
    return !!this.copyrightText.trim();
  }

  /** Крупнее: увеличенный размер шрифта. */
  get copyrightLarge(): boolean {
    const large = this.footer?.copyright?.large;
    return large !== 0 && !!large;
  }

  get bottomLinks(): FooterLink[] {
    // Ссылки без адреса на сайте не показываем
    return (this.footer?.bottom_links ?? []).filter((link) => !!link.label?.trim() && !!link.url?.trim());
  }

  isExternal(url: string): boolean {
    return /^https?:\/\//.test(url);
  }
}
