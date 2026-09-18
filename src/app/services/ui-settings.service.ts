import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Карта настроек интерфейса. Каждая новая UI-настройка добавляется сюда —
 * сервис сам хранит значения в localStorage и раздаёт их по ключу.
 */
export interface UiSettingsMap {
  /** Свёрнуто ли боковое меню админки (только иконки). */
  'admin.sidebarCollapsed': boolean;
  // Примеры будущих настроек:
  // 'admin.theme': 'light' | 'dark';
  // 'admin.tableDensity': 'compact' | 'comfortable';
  // 'admin.showGridLines': boolean;
}

type UiKey = keyof UiSettingsMap;

const STORAGE_KEY = 'ui_settings';

/**
 * Хранение настроек интерфейса в localStorage.
 *
 * Почему localStorage, а не БД:
 *  - это настройки «как выглядит панель у меня на этом устройстве», а не бизнес-данные;
 *  - применяются мгновенно (без запроса к серверу), работают офлайн;
 *  - не требуют изменений схемы/API.
 *
 * Интерфейс абстрактный (get/set/toggle/watch) — если позже понадобится синхронизация
 * настроек между устройствами, добавим реализацию на БД за тем же интерфейсом,
 * не меняя компоненты.
 */
@Injectable({ providedIn: 'root' })
export class UiSettingsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly state: Record<string, unknown> = this.load();
  private readonly changes = new BehaviorSubject<Record<string, unknown>>(this.state);

  get<K extends UiKey>(key: K, fallback: UiSettingsMap[K]): UiSettingsMap[K] {
    const value = this.state[key as string];
    return value === undefined ? fallback : (value as UiSettingsMap[K]);
  }

  set<K extends UiKey>(key: K, value: UiSettingsMap[K]): void {
    this.state[key as string] = value;
    this.persist();
    this.changes.next({ ...this.state });
  }

  toggle<K extends UiKey>(key: K, fallback: UiSettingsMap[K]): UiSettingsMap[K] {
    const next = !this.get(key, fallback) as UiSettingsMap[K];
    this.set(key, next);
    return next;
  }

  /** Подписка на изменения любых настроек (для реактивных обновлений). */
  watch(): Observable<Record<string, unknown>> {
    return this.changes.asObservable();
  }

  private load(): Record<string, unknown> {
    if (!isPlatformBrowser(this.platformId)) {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // приватный режим / переполнение — молча игнорируем
    }
  }
}
