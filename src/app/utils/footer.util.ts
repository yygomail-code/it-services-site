import { FooterContactField, FooterContactItem, FooterContacts } from '../models/admin.model';

/** Название по умолчанию — если в разделе «Бренд» ничего не заполнено. */
export const DEFAULT_BRAND_NAME = 'Литвинов Антон';

/** Метка бренда: из настроек, иначе первая буква названия, иначе «А». */
export function brandMark(mark: string, name: string): string {
  const m = mark.trim();
  if (m) {
    return m;
  }
  const n = name.trim();
  return n ? n.charAt(0) : 'А';
}

/** Доступные поля контактов и их подписи. */
export const FOOTER_CONTACT_FIELDS: Array<{ field: FooterContactField; label: string }> = [
  { field: 'phone', label: 'Телефон' },
  { field: 'email', label: 'Почта' },
  { field: 'city', label: 'Город' },
  { field: 'address', label: 'Адрес' },
  { field: 'max', label: 'Макс' },
  { field: 'telegram', label: 'Телеграм' },
  { field: 'whatsapp', label: 'Ватсап' },
  { field: 'viber', label: 'Вайбер' },
  { field: 'vk', label: 'ВК' },
];

const FIELD_ORDER: FooterContactField[] = [
  'phone',
  'email',
  'city',
  'address',
  'max',
  'telegram',
  'whatsapp',
  'viber',
  'vk',
];

export function contactFieldLabel(field: FooterContactField): string {
  return FOOTER_CONTACT_FIELDS.find((f) => f.field === field)?.label ?? field;
}

/** Ключ настройки в site_content для поля контакта. */
export function contactFieldKey(field: FooterContactField): string {
  return `contacts.${field}`;
}

function isOn(value: unknown): boolean {
  return value !== 0 && value !== false && value !== '0';
}

function defaultItems(): FooterContactItem[] {
  return FIELD_ORDER.map((field) => ({
    field,
    show: field === 'address' ? 0 : 1,
    icon: 1,
    large: 0,
    gap: 0,
  }));
}

/**
 * Приводит contacts из конфига футера к актуальному виду.
 * Поддерживает старый формат {phone, email, city, show} и общий флаг icons —
 * значения из них больше не используются: источник один — раздел «Контакты».
 * Видимость блока определяется наличием включённых контактов со значениями.
 */
export function normalizeFooterContacts(raw: unknown): FooterContacts {
  if (!raw || typeof raw !== 'object') {
    return { items: defaultItems() };
  }
  const obj = raw as Record<string, unknown>;
  // Старый общий переключатель иконок — значение по умолчанию для строк
  const legacyIcons = obj['icons'] === undefined ? 1 : isOn(obj['icons']) ? 1 : 0;

  if (Array.isArray(obj['items'])) {
    const seen = new Set<string>();
    const items: FooterContactItem[] = [];
    for (const rawItem of obj['items'] as Array<Record<string, unknown>>) {
      const field = rawItem?.['field'];
      if (typeof field !== 'string' || !FIELD_ORDER.includes(field as FooterContactField) || seen.has(field)) {
        continue;
      }
      seen.add(field);
      items.push({
        field: field as FooterContactField,
        show: isOn(rawItem['show']) ? 1 : 0,
        icon: rawItem['icon'] === undefined ? legacyIcons : isOn(rawItem['icon']) ? 1 : 0,
        large: isOn(rawItem['large']) ? 1 : 0,
        gap: isOn(rawItem['gap']) ? 1 : 0,
      });
    }
    // Недостающие поля добавляем выключенными, чтобы их можно было включить в редакторе
    for (const field of FIELD_ORDER) {
      if (!seen.has(field)) {
        items.push({ field, show: 0, icon: legacyIcons, large: 0, gap: 0 });
      }
    }
    return { items };
  }

  return { items: defaultItems() };
}

function isUrl(value: string): boolean {
  // Полный URL: схема + хост с точкой
  return /^https?:\/\/[^\s/]+\.[^\s/]{2,}/i.test(value);
}

function looksLikeUrlAttempt(value: string): boolean {
  // Похоже на попытку ввести ссылку, но, возможно, неполную
  return /^https?:/i.test(value) || value.includes('://');
}

function isPhoneLike(value: string): boolean {
  if (!/^[+()\d\s-]+$/.test(value)) {
    return false;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 5 && digits.length <= 15;
}

/** Ссылка для значения контакта (tel:/mailto:/мессенджеры) или null для простого текста. */
export function contactHref(field: FooterContactField, value: string): string | null {
  const v = value.trim();
  if (!v) {
    return null;
  }
  if (isUrl(v)) {
    return v;
  }
  // Диплинки мессенджеров (tg://, viber://) — уже готовые ссылки
  if (/^(tg|viber):\/\//i.test(v)) {
    return v;
  }
  // Неполная ссылка (например, «http://») — не превращаем в битую
  if (looksLikeUrlAttempt(v)) {
    return null;
  }
  if (field === 'phone') {
    return 'tel:' + v.replace(/[^+\d]/g, '');
  }
  if (field === 'email') {
    return 'mailto:' + v;
  }
  if (field === 'telegram') {
    if (isPhoneLike(v)) {
      return null;
    }
    const username = v.replace(/^@/, '').replace(/^(t\.me|telegram\.me)\//i, '');
    return username ? `https://t.me/${username}` : null;
  }
  if (field === 'whatsapp') {
    const raw = v.replace(/^@/, '').replace(/^(www\.)?wa\.me\//i, '');
    const digits = raw.replace(/[^\d]/g, '');
    return isPhoneLike(raw) && digits ? `https://wa.me/${digits}` : null;
  }
  if (field === 'viber') {
    const raw = v.replace(/^@/, '').replace(/^(www\.)?viber\.com\//i, '');
    const digits = raw.replace(/[^\d]/g, '');
    return isPhoneLike(raw) && digits ? `viber://chat?number=%2B${digits}` : null;
  }
  if (field === 'vk') {
    if (isPhoneLike(v)) {
      return null;
    }
    const username = v.replace(/^@/, '').replace(/^vk\.com\//i, '');
    return username ? `https://vk.com/${username}` : null;
  }
  if (field === 'max') {
    const raw = v
      .replace(/^@/, '')
      .replace(/^(https?:\/\/)?(www\.)?max\.ru\//i, '')
      .trim();
    if (!raw) {
      return null;
    }
    const username = isPhoneLike(raw) ? raw.replace(/[^\d+]/g, '') : raw.replace(/\s+/g, '');
    return `http://max.ru/${username}`;
  }
  return null;
}

/** Отображаемое значение контакта: у «Макс» показываем адрес без протокола (он остаётся в ссылке). */
export function contactDisplayValue(field: FooterContactField, value: string): string {
  if (field === 'max') {
    const href = contactHref('max', value);
    return href ? href.replace(/^https?:\/\//i, '') : value;
  }
  return value;
}

/**
 * Проверка адреса ссылки футера.
 * Пусто — допустимо (ссылка не покажется на сайте).
 * Разрешено: внутренний путь (/services, /policy#top), полный https-адрес, mailto:, tel:.
 */
export function linkUrlError(url: string): string {
  const v = url.trim();
  if (v === '') {
    return '';
  }
  if (v.startsWith('/')) {
    return /^\/\S*$/.test(v) ? '' : 'В пути не должно быть пробелов';
  }
  if (/^https?:\/\/[^\s/]+\.[^\s/]{2,}(\/\S*)?$/i.test(v)) {
    return '';
  }
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v)) {
    return '';
  }
  if (/^tel:\+?[\d\s()\-]{5,20}$/i.test(v)) {
    return '';
  }
  return 'Укажите путь (/services) или полный адрес (https://…)';
}
