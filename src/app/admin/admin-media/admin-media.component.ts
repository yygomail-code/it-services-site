import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { MediaItem } from '../../models/admin.model';

@Component({
  selector: 'app-admin-media',
  templateUrl: './admin-media.html',
  styleUrl: './admin-media.scss',
})
export class AdminMediaComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly cdr = inject(ChangeDetectorRef);

  media: MediaItem[] = [];
  filtered: MediaItem[] = [];
  loading = true;
  error = '';
  uploading = false;
  uploadError = '';
  search = '';

  // Drag & drop
  dragOver = false;

  // Модальное окно редактирования
  selected: MediaItem | null = null;
  editTitle = '';
  editAlt = '';
  editDescription = '';
  saving = false;
  savedFlag = false;
  saveError = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.admin.getMedia().subscribe({
      next: (res) => {
        this.media = res.media;
        this.applyFilter();
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

  applyFilter(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = q
      ? this.media.filter((m) => {
          const hay = `${m.file_name} ${m.title ?? ''} ${m.alt ?? ''}`.toLowerCase();
          return hay.includes(q);
        })
      : this.media;
    this.cdr.markForCheck();
  }

  onSearch(value: string): void {
    this.search = value;
    this.applyFilter();
  }

  // ---- Загрузка ----
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length) {
      this.uploadMany(Array.from(files));
    }
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files.length) {
      this.uploadMany(Array.from(files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
  }

  private uploadMany(files: File[]): void {
    this.uploading = true;
    this.uploadError = '';
    let remaining = files.length;
    let failed = false;
    this.cdr.markForCheck();

    for (const file of files) {
      this.admin.uploadMedia(file).subscribe({
        next: (res) => {
          remaining -= 1;
          if (!res.ok) {
            failed = true;
          }
          if (remaining === 0) {
            this.uploading = false;
            if (failed) {
              this.uploadError = 'Не удалось загрузить часть файлов';
            }
            this.load();
            this.cdr.markForCheck();
          }
        },
        error: () => {
          remaining -= 1;
          failed = true;
          if (remaining === 0) {
            this.uploading = false;
            this.uploadError = 'Не удалось загрузить файлы';
            this.load();
            this.cdr.markForCheck();
          }
        },
      });
    }
  }

  // ---- Модальное окно ----
  openDetails(item: MediaItem): void {
    this.selected = item;
    this.editTitle = item.title ?? '';
    this.editAlt = item.alt ?? '';
    this.editDescription = item.description ?? '';
    this.savedFlag = false;
    this.saveError = '';
    this.cdr.markForCheck();
  }

  closeDetails(): void {
    this.selected = null;
    this.cdr.markForCheck();
  }

  saveDetails(): void {
    if (!this.selected || this.saving) {
      return;
    }
    this.saving = true;
    this.saveError = '';
    this.savedFlag = false;
    this.cdr.markForCheck();
    this.admin
      .updateMedia(this.selected.id, {
        title: this.editTitle,
        alt: this.editAlt,
        description: this.editDescription,
      })
      .subscribe({
        next: (res) => {
          this.saving = false;
          if (res.ok) {
            this.savedFlag = true;
            if (this.selected) {
              this.selected.title = this.editTitle;
              this.selected.alt = this.editAlt;
              this.selected.description = this.editDescription;
            }
            setTimeout(() => {
              this.savedFlag = false;
              this.cdr.markForCheck();
            }, 2500);
          } else {
            this.saveError = res.error ?? 'Не удалось сохранить';
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.saving = false;
          this.saveError = 'Не удалось сохранить';
          this.cdr.markForCheck();
        },
      });
  }

  copyUrl(item: MediaItem): void {
    const url = window.location.origin + item.url;
    navigator.clipboard?.writeText(url).then(
      () => alert(`Ссылка скопирована:\n${url}`),
      () => alert(`Ссылка:\n${url}`),
    );
  }

  remove(item: MediaItem): void {
    const name = item.title || item.file_name;
    if (!confirm(`Удалить файл «${name}»?`)) {
      return;
    }
    this.admin.deleteMedia(item.id).subscribe({
      next: () => {
        this.media = this.media.filter((m) => m.id !== item.id);
        this.applyFilter();
        if (this.selected?.id === item.id) {
          this.selected = null;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        alert('Не удалось удалить файл');
      },
    });
  }

  /** Кто добавил файл в медиатеку. */
  uploaderText(item: MediaItem): string {
    return item.uploaded_by_name || item.uploaded_by_login || '—';
  }

  /** Где используется файл (пока аватары пользователей). */
  usageText(item: MediaItem): string {
    if (item.used_as_avatar) {
      return 'аватар: ' + item.used_as_avatar;
    }
    return '—';
  }
  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} Б`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} КБ`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  }

  formatDate(d?: string): string {
    if (!d) {
      return '';
    }
    const date = new Date(d.replace(' ', 'T'));
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  onEditTitle(value: string): void {
    this.editTitle = value;
    this.cdr.markForCheck();
  }

  onEditAlt(value: string): void {
    this.editAlt = value;
    this.cdr.markForCheck();
  }

  onEditDescription(value: string): void {
    this.editDescription = value;
    this.cdr.markForCheck();
  }

  dimensions(item: MediaItem): string {
    if (item.width && item.height) {
      return `${item.width} × ${item.height}`;
    }
    return '';
  }

  isImage(item: MediaItem): boolean {
    return item.mime.startsWith('image/');
  }

  trackItem(_index: number, item: MediaItem): number {
    return item.id;
  }
}
