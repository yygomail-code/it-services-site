import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { ContentService } from '../../services/content.service';

export type SettingType = 'phone' | 'email' | 'city' | 'address' | 'messenger' | 'text' | 'textarea';
export type MessengerKind = 'telegram' | 'whatsapp' | 'viber' | 'vk' | 'max';

export interface SettingItem {
  key: string;
  label: string;
  type: SettingType;
  /** Для type='messenger': какой мессенджер — от него зависят правила проверки. */
  kind?: MessengerKind;
  placeholder: string;
  hint: string;
  value: string;
  maxLength: number;
  error: string;
}

const PHONE_RE = /^\+?[0-9\s()\-]{10,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CITY_RE = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\s\-.(),]*$/;
/** Полная ссылка: схема + хост с точкой (например, https://max.ru/username). */
const MESSENGER_URL_RE = /^https?:\/\/[^\s/]+\.[^\s/]{2,}(\/\S*)?$/i;
/** Диплинки мессенджеров (tg://, viber://) принимаем как есть. */
const DEEP_LINK_RE = /^(tg|viber):\/\/\S+$/i;
/** Любая схема в начале значения — похоже на попытку вставить ссылку. */
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/** Домены, которые можно указывать перед именем пользователя. */
const MESSENGER_DOMAIN: Record<MessengerKind, RegExp> = {
  telegram: /^(t\.me|telegram\.me)\//i,
  whatsapp: /^wa\.me\//i,
  viber: /^viber\.com\//i,
  vk: /^vk\.com\//i,
  max: /^max\.ru\//i,
};

/** Допустимое значение после домена (имя пользователя или номер). */
const MESSENGER_HANDLE: Record<MessengerKind, RegExp> = {
  telegram: /^[A-Za-z0-9_]{3,32}$/,
  whatsapp: /^[0-9]{10,15}$/,
  viber: /^[0-9]{10,15}$/,
  vk: /^[A-Za-z0-9_.]{2,32}$/,
  max: /^[A-Za-z0-9_.]{2,32}$/,
};

const MESSENGER_HINT: Record<MessengerKind, string> = {
  telegram: 'Проверьте имя пользователя. Пример: @username или t.me/username',
  whatsapp: 'Проверьте номер. Пример: +7 900 000-00-00',
  viber: 'Проверьте номер. Пример: +7 900 000-00-00',
  vk: 'Проверьте адрес. Пример: vk.com/username',
  max: 'Проверьте адрес. Пример: max.ru/username',
};

function isPhoneLike(v: string): boolean {
  return /^\+?[0-9\s()\-]+$/.test(v);
}

function hasValidPhoneDigits(v: string): boolean {
  const digits = v.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

@Component({
  selector: 'app-admin-settings',
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss',
})
export class AdminSettingsComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly content = inject(ContentService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  error = '';
  saving = false;
  saved = false;
  saveError = '';

  settings: SettingItem[] = [
    {
      key: 'contacts.phone',
      label: 'Телефон',
      type: 'phone',
      placeholder: '+7 (___) ___-__-__',
      hint: 'Показывается в футере, на главной и на странице контактов',
      value: '',
      maxLength: 20,
      error: '',
    },
    {
      key: 'contacts.email',
      label: 'Почта',
      type: 'email',
      placeholder: 'name@example.ru',
      hint: 'Показывается в футере и на странице контактов',
      value: '',
      maxLength: 120,
      error: '',
    },
    {
      key: 'contacts.city',
      label: 'Город',
      type: 'city',
      placeholder: 'Краснодар',
      hint: 'Показывается в футере и на странице контактов',
      value: '',
      maxLength: 80,
      error: '',
    },
    {
      key: 'contacts.address',
      label: 'Адрес',
      type: 'address',
      placeholder: 'ул. Красная, д. 1, офис 10',
      hint: 'Улица, дом, офис',
      value: '',
      maxLength: 200,
      error: '',
    },
    {
      key: 'contacts.max',
      label: 'Макс',
      type: 'messenger',
      kind: 'max',
      placeholder: '+7 900 000-00-00 или ссылка',
      hint: 'Показывается в футере, если контакт включён в настройках футера',
      value: '',
      maxLength: 200,
      error: '',
    },
    {
      key: 'contacts.telegram',
      label: 'Телеграм',
      type: 'messenger',
      kind: 'telegram',
      placeholder: '@username или ссылка',
      hint: 'Показывается в футере, если контакт включён в настройках футера',
      value: '',
      maxLength: 200,
      error: '',
    },
    {
      key: 'contacts.whatsapp',
      label: 'Ватсап',
      type: 'messenger',
      kind: 'whatsapp',
      placeholder: '+7 900 000-00-00',
      hint: 'Показывается в футере, если контакт включён в настройках футера',
      value: '',
      maxLength: 200,
      error: '',
    },
    {
      key: 'contacts.viber',
      label: 'Вайбер',
      type: 'messenger',
      kind: 'viber',
      placeholder: '+7 900 000-00-00',
      hint: 'Показывается в футере, если контакт включён в настройках футера',
      value: '',
      maxLength: 200,
      error: '',
    },
    {
      key: 'contacts.vk',
      label: 'ВК',
      type: 'messenger',
      kind: 'vk',
      placeholder: 'vk.com/username или ссылка',
      hint: 'Показывается в футере, если контакт включён в настройках футера',
      value: '',
      maxLength: 200,
      error: '',
    },
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
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Не удалось загрузить настройки';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onInput(item: SettingItem, value: string): void {
    item.value = value;
    this.validate(item);
    this.cdr.markForCheck();
  }

  /** Пустое значение — валидно (можно сохранить). Непустое — проверяется по типу. */
  validate(item: SettingItem): boolean {
    const v = item.value.trim();
    if (v === '') {
      item.error = '';
      return true;
    }
    if (v.length > item.maxLength) {
      item.error = `Слишком длинное значение (максимум ${item.maxLength} символов)`;
      return false;
    }
    if (item.type === 'phone') {
      item.error = PHONE_RE.test(v) && hasValidPhoneDigits(v) ? '' : 'Некорректный телефон. Пример: +7 938 026-49-03';
      return item.error === '';
    }
    if (item.type === 'email') {
      item.error = EMAIL_RE.test(v) ? '' : 'Некорректный e-mail. Пример: name@example.ru';
      return item.error === '';
    }
    if (item.type === 'city') {
      item.error = v.length >= 2 && CITY_RE.test(v) ? '' : 'Проверьте название города. Пример: Краснодар';
      return item.error === '';
    }
    if (item.type === 'address') {
      const letters = (v.match(/[A-Za-zА-Яа-яЁё]/g) ?? []).length;
      item.error = letters >= 2 ? '' : 'Проверьте адрес. Пример: ул. Красная, д. 1, офис 10';
      return item.error === '';
    }
    if (item.type === 'messenger') {
      const kind: MessengerKind = item.kind ?? 'telegram';
      // Полная ссылка или диплинк — принимаем
      if (MESSENGER_URL_RE.test(v) || DEEP_LINK_RE.test(v)) {
        item.error = '';
        return true;
      }
      // Похоже на ссылку, но неполную («http://», «https://», «http://max»)
      if (SCHEME_RE.test(v) || v.includes('://')) {
        item.error = 'Неполная ссылка. Укажите полный адрес (пример: https://max.ru/username) или имя пользователя';
        return false;
      }
      // Телефон
      if (isPhoneLike(v)) {
        item.error = hasValidPhoneDigits(v) ? '' : MESSENGER_HINT[kind];
        return item.error === '';
      }
      // Имя пользователя, можно с доменом (t.me/…, vk.com/…, max.ru/…)
      const handle = v.replace(/^@/, '').replace(MESSENGER_DOMAIN[kind], '');
      item.error = MESSENGER_HANDLE[kind].test(handle) ? '' : MESSENGER_HINT[kind];
      return item.error === '';
    }
    item.error = '';
    return true;
  }

  /** Валидна ли вся форма: все непустые поля корректны. Пустые — допустимы. */
  get valid(): boolean {
    return this.settings.every((item) => {
      this.validate(item);
      return item.error === '';
    });
  }

  saveAll(): void {
    if (this.saving) {
      return;
    }
    if (!this.valid) {
      this.saveError = 'Исправьте ошибки в полях';
      this.cdr.markForCheck();
      return;
    }
    this.saving = true;
    this.saveError = '';
    this.saved = false;

    // Сохраняем последовательно все настройки
    const pending = this.settings.map((item) => {
      const value = item.value.trim();
      // Пустое значение — сохраняем null (удаляем с сайта)
      return this.admin.setContent(item.key, value === '' ? null : value);
    });

    // Ждём все запросы
    let completed = 0;
    let hasError = false;
    for (const obs of pending) {
      obs.subscribe({
        next: () => {
          completed += 1;
          if (completed === pending.length) {
            this.finishSave(hasError);
          }
        },
        error: () => {
          hasError = true;
          completed += 1;
          if (completed === pending.length) {
            this.finishSave(hasError);
          }
        },
      });
    }
  }

  private finishSave(hasError: boolean): void {
    this.saving = false;
    if (hasError) {
      this.saveError = 'Не удалось сохранить часть настроек';
    } else {
      this.saved = true;
      // Обновляем контакты в футере без перезагрузки
      this.content.loadContent();
      setTimeout(() => {
        this.saved = false;
        this.cdr.markForCheck();
      }, 2500);
    }
    this.cdr.markForCheck();
  }
}
