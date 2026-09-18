import { Component, OnInit, PLATFORM_ID, inject, ChangeDetectorRef, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ContentService } from '../../services/content.service';
import { HeaderConfig, HeaderCta, HeaderMenuItem } from '../../models/admin.model';
import { brandMark } from '../../utils/footer.util';
import {
  DEFAULT_HEADER_CTA,
  DEFAULT_HEADER_MENU,
  DEFAULT_HEADER_SUBTITLE,
} from '../../utils/header.util';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly content = inject(ContentService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  menuOpen = false;

  /** Настройки из раздела «Хеадер» (если сохраняли). */
  header: HeaderConfig | null = null;

  /** Опции routerLinkActive: для главной — точное совпадение адреса. */
  readonly exactOptions = { exact: true };
  readonly looseOptions = { exact: false };

  constructor() {
    // Настройки шапки приходят после загрузки контента и обновляются при сохранении
    effect(() => {
      if (this.content.ready()) {
        this.content.revision();
        // видимость пунктов зависит от роли пользователя и проверки сессии
        this.auth.user();
        this.auth.ready();
        this.header = this.content.getHeader();
        this.cdr.markForCheck();
      }
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.auth.fetchMe().subscribe();
    }
  }

  /** Единый бренд сайта. */
  get brandName(): string {
    return this.content.getBrand().name;
  }

  get brandLogo(): string {
    return this.content.getBrand().logo;
  }

  get brandMark(): string {
    const brand = this.content.getBrand();
    return brandMark(brand.mark, brand.name);
  }

  /** Подпись у логотипа: из настроек или стандартная. */
  get subtitle(): string {
    return this.header ? this.header.subtitle : DEFAULT_HEADER_SUBTITLE;
  }

  /** Крупнее: увеличенный размер подписи. */
  get subtitleLarge(): boolean {
    const large = this.header?.subtitle_large;
    return large !== 0 && !!large;
  }

  /** Пункты меню: из настроек или стандартные, с учётом видимости по ролям. */
  get menuItems(): HeaderMenuItem[] {
    const items = this.header ? this.header.menu : DEFAULT_HEADER_MENU;
    return items.filter(
      (item) => this.itemShown(item) && !!item.label?.trim() && !!item.url?.trim(),
    );
  }

  /** Кнопка справа: из настроек или стандартная. */
  get cta(): HeaderCta | null {
    const cta = this.header ? this.header.cta : DEFAULT_HEADER_CTA;
    if (!cta || !cta.label?.trim() || !cta.url?.trim() || !this.itemShown(cta)) {
      return null;
    }
    return cta;
  }

  /**
   * Показывать ли элемент сейчас. Элементы без ограничений — сразу;
   * с ролями — только после проверки сессии, иначе при загрузке
   * мелькают пункты, закрытые для роли пользователя.
   */
  private itemShown(item: { roles?: string[] | null }): boolean {
    if (item.roles === null || item.roles === undefined) {
      return true;
    }
    return this.auth.ready() && this.itemVisible(item);
  }

  /** Видимость пункта по ролям: не задано — всем, пусто — никому. */
  itemVisible(item: { roles?: string[] | null }): boolean {
    const roles = item.roles;
    if (roles === null || roles === undefined) {
      return true;
    }
    if (roles.length === 0) {
      return false;
    }
    const role = this.auth.user()?.role ?? 'guest';
    return roles.includes(role);
  }

  isExternal(url: string): boolean {
    return /^https?:\/\//.test(url);
  }

  isExact(url: string): boolean {
    return url === '/';
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }
}
