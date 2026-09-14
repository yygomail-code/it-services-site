import { Component, inject, OnInit } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { ContentMap } from '../../models/admin.model';

@Component({
  selector: 'app-admin-content',
  templateUrl: './admin-content.html',
  styleUrl: './admin-content.scss',
})
export class AdminContentComponent implements OnInit {
  private readonly admin = inject(AdminService);

  content: ContentMap = {};
  keys: string[] = [];
  loading = true;
  error = '';
  savedKey: string | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.admin.getContent().subscribe({
      next: (res) => {
        this.content = res.content;
        this.keys = Object.keys(res.content).sort();
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить контент';
        this.loading = false;
      },
    });
  }

  addKey(): void {
    const key = prompt('Введите ключ (латиницей: section.field, например main.phone):');
    if (!key || !/^[a-z0-9_\.\-]{1,128}$/.test(key)) {
      return;
    }
    if (this.content[key] !== undefined) {
      alert('Такой ключ уже существует');
      return;
    }
    this.content[key] = '';
    this.keys = Object.keys(this.content).sort();
  }

  save(key: string): void {
    const value = this.content[key];
    this.admin.setContent(key, value ?? null).subscribe({
      next: () => {
        this.savedKey = key;
        setTimeout(() => (this.savedKey = null), 2000);
      },
      error: () => {
        alert('Не удалось сохранить');
      },
    });
  }

  remove(key: string): void {
    if (!confirm(`Удалить ключ "${key}"?`)) {
      return;
    }
    this.admin.setContent(key, null).subscribe({
      next: () => {
        delete this.content[key];
        this.keys = Object.keys(this.content).sort();
      },
      error: () => {
        alert('Не удалось удалить');
      },
    });
  }

  trackKey(_index: number, key: string): string {
    return key;
  }

  setValue(key: string, value: string): void {
    this.content[key] = value;
  }
}
