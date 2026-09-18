import { Component, EventEmitter, inject, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { MediaItem } from '../../models/admin.model';

/** Модальное окно выбора изображения из медиатеки. */
@Component({
  selector: 'app-admin-media-picker',
  templateUrl: './admin-media-picker.html',
  styleUrl: './admin-media-picker.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class AdminMediaPickerComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Выбрано изображение — отдаём URL наружу. */
  @Output() readonly pick = new EventEmitter<string>();
  @Output() readonly closed = new EventEmitter<void>();

  loading = true;
  error = '';
  items: MediaItem[] = [];

  ngOnInit(): void {
    this.admin.getMedia().subscribe({
      next: (res) => {
        this.items = (res.media ?? []).filter((m) => (m.mime ?? '').startsWith('image/'));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить медиатеку';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  choose(item: MediaItem): void {
    this.pick.emit(item.url);
  }

  close(): void {
    this.closed.emit();
  }
}
