import { Component, inject, OnInit } from '@angular/core';
import { AdminService } from '../../services/admin.service';

export interface SettingItem {
  key: string;
  label: string;
  value: string;
}

@Component({
  selector: 'app-admin-settings',
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss',
})
export class AdminSettingsComponent implements OnInit {
  private readonly admin = inject(AdminService);

  loading = true;
  error = '';
  savedKey: string | null = null;

  settings: SettingItem[] = [
    { key: 'contacts.phone', label: 'Телефон', value: '' },
    { key: 'contacts.email', label: 'Почта', value: '' },
    { key: 'contacts.city', label: 'Город', value: '' },
    { key: 'main.heroTitle', label: 'Заголовок на главной', value: '' },
    { key: 'main.heroSubtitle', label: 'Подзаголовок на главной', value: '' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.admin.getContent().subscribe({
      next: (res) => {
        for (const item of this.settings) {
          item.value = res.content[item.key] ?? '';
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить настройки';
        this.loading = false;
      },
    });
  }

  save(item: SettingItem): void {
    this.admin.setContent(item.key, item.value || null).subscribe({
      next: () => {
        this.savedKey = item.key;
        setTimeout(() => (this.savedKey = null), 2000);
      },
      error: () => alert('Не удалось сохранить'),
    });
  }

  setValue(item: SettingItem, value: string): void {
    item.value = value;
  }
}
