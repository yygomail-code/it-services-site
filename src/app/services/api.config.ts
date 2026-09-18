import { InjectionToken } from '@angular/core';

/**
 * База для запросов к API.
 * В браузере — пустая строка: относительные пути работают на любом домене.
 * При SSR/prerender — абсолютный адрес API, иначе контент из БД не попадает
 * в статический HTML и роботы видят пустой каркас страницы.
 */
export const API_BASE = new InjectionToken<string>('API_BASE', {
  providedIn: 'root',
  factory: () => '',
});

/** Полный адрес метода API с учётом базы. */
export function apiUrl(base: string, path: string): string {
  return base ? `${base}${path}` : path;
}
