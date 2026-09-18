import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { ContentService } from '../../services/content.service';
import { FooterConfig, FooterLink, LinkTarget, Page } from '../../models/admin.model';
import { AdminLinkEditorComponent } from '../admin-link-editor/admin-link-editor.component';
import { linkUrlError } from '../../utils/footer.util';

@Component({
  selector: 'app-admin-footer-bottom',
  imports: [AdminLinkEditorComponent],
  templateUrl: './admin-footer-bottom.html',
  styleUrl: './admin-footer-bottom.scss',
})
export class AdminFooterBottomComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly content = inject(ContentService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  saving = false;
  error = '';
  saved = false;

  copyrightText = '';
  /** Крупнее: увеличенный размер шрифта. */
  copyrightLarge = false;
  links: FooterLink[] = [];

  /** Страницы для выбора ссылок из выпадающего списка. */
  pages: Page[] = [];
  /** Разделы, группы и позиции каталога для выбора ссылок. */
  linkTargets: LinkTarget[] = [];

  ngOnInit(): void {
    this.admin.getFooter().subscribe({
      next: (res) => {
        const f = res.footer as unknown as FooterConfig;
        this.copyrightText = f?.copyright?.text ?? '';
        this.copyrightLarge = !!f?.copyright?.large;
        this.links = (f?.bottom_links ?? []).map((l) => ({ label: l.label, url: l.url }));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить настройки подвала';
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
  }

  onCopyright(v: string): void {
    this.copyrightText = v;
    this.cdr.markForCheck();
  }

  toggleCopyrightLarge(v: boolean): void {
    this.copyrightLarge = v;
    this.cdr.markForCheck();
  }

  addLink(): void {
    this.links.push({ label: '', url: '' });
    this.cdr.markForCheck();
  }

  /** Перестановка ссылки подвала вверх/вниз. */
  moveLink(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= this.links.length) {
      return;
    }
    const tmp = this.links[index];
    this.links[index] = this.links[target];
    this.links[target] = tmp;
    this.cdr.markForCheck();
  }

  removeLink(index: number): void {
    const link = this.links[index];
    const name = link?.label?.trim() || 'без названия';
    if (!confirm(`Удалить ссылку «${name}»?`)) {
      return;
    }
    this.links.splice(index, 1);
    this.cdr.markForCheck();
  }

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
    // Отправляем только свои ключи — чтобы не затереть «Футер» (logo, columns, contacts)
    const config = {
      copyright: { text: this.copyrightText, large: this.copyrightLarge ? 1 : 0 },
      bottom_links: this.links.filter((l) => l.label.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    };

    this.saving = true;
    this.error = '';
    this.saved = false;
    this.admin.saveFooter(config).subscribe({
      next: (res) => {
        this.saving = false;
        if (res.ok) {
          this.saved = true;
          // Обновляем подвал на сайте без перезагрузки
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
        this.error = 'Не удалось сохранить подвал';
        this.cdr.markForCheck();
      },
    });
  }

  trackLink(_index: number): number {
    return _index;
  }

  /** Первая ошибка в адресах ссылок подвала (пусто — всё корректно). */
  private linksError(): string {
    for (const link of this.links) {
      const err = linkUrlError(link.url);
      if (err) {
        return `Ссылка «${link.label.trim() || 'без названия'}»: ${err}`;
      }
    }
    return '';
  }
}
