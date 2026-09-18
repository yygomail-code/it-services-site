import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { ContentService } from '../../services/content.service';
import { AdminMediaPickerComponent } from '../admin-media-picker/admin-media-picker.component';
import { DEFAULT_BRAND_NAME, brandMark } from '../../utils/footer.util';

/** Единый бренд сайта: логотип, название, метка (шапка, футер, админка). */
@Component({
  selector: 'app-admin-brand',
  imports: [AdminMediaPickerComponent],
  templateUrl: './admin-brand.html',
  styleUrl: './admin-brand.scss',
})
export class AdminBrandComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly content = inject(ContentService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  saving = false;
  saved = false;
  error = '';
  saveError = '';

  name = '';
  mark = '';
  logo = '';
  mediaPickerOpen = false;

  ngOnInit(): void {
    this.admin.getContent().subscribe({
      next: (res) => {
        this.name = res.content['brand.name'] ?? '';
        this.mark = res.content['brand.mark'] ?? '';
        this.logo = res.content['brand.logo'] ?? '';
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить настройки бренда';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onName(v: string): void {
    this.name = v;
    this.cdr.markForCheck();
  }

  /** Метка: только первый символ. */
  onMark(v: string): void {
    this.mark = v.slice(0, 1);
    this.cdr.markForCheck();
  }

  openMediaPicker(): void {
    this.mediaPickerOpen = true;
    this.cdr.markForCheck();
  }

  closeMediaPicker(): void {
    this.mediaPickerOpen = false;
    this.cdr.markForCheck();
  }

  onLogoPicked(url: string): void {
    this.logo = url;
    this.mediaPickerOpen = false;
    this.cdr.markForCheck();
  }

  clearLogo(): void {
    this.logo = '';
    this.cdr.markForCheck();
  }

  /** Метка, которая попадёт на сайт при пустом поле. */
  get previewMark(): string {
    return brandMark(this.mark, this.name.trim() || DEFAULT_BRAND_NAME);
  }

  save(): void {
    if (this.saving) {
      return;
    }
    this.saving = true;
    this.saved = false;
    this.saveError = '';

    const items: Array<{ key: string; value: string | null }> = [
      { key: 'brand.name', value: this.name.trim() || null },
      { key: 'brand.mark', value: this.mark.trim() || null },
      { key: 'brand.logo', value: this.logo.trim() || null },
    ];

    let done = 0;
    let failed = false;
    for (const item of items) {
      this.admin.setContent(item.key, item.value).subscribe({
        next: () => {
          done += 1;
          if (done === items.length) {
            this.finishSave(failed);
          }
        },
        error: () => {
          failed = true;
          done += 1;
          if (done === items.length) {
            this.finishSave(failed);
          }
        },
      });
    }
  }

  private finishSave(failed: boolean): void {
    this.saving = false;
    if (failed) {
      this.saveError = 'Не удалось сохранить часть настроек';
    } else {
      this.saved = true;
      // Обновляем бренд в шапке, футере и админке без перезагрузки
      this.content.loadContent();
      setTimeout(() => {
        this.saved = false;
        this.cdr.markForCheck();
      }, 2500);
    }
    this.cdr.markForCheck();
  }
}
