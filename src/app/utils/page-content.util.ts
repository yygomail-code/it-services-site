import {
  Page,
  PageBlock,
  PageColumn,
  PageContent,
  PageSection,
  PageSectionBg,
  PageSectionGap,
} from '../models/admin.model';

let uidCounter = 0;

export function newUid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function createEmptyBlock(type: PageBlock['type']): PageBlock {
  switch (type) {
    case 'text':
      return { type: 'text', text: '', align: 'left' };
    case 'heading':
      return { type: 'heading', text: '', level: 'h2', align: 'left' };
    case 'image':
      return { type: 'image', url: '', alt: '', caption: '', align: 'center', width: 'auto' };
    case 'gallery':
      return { type: 'gallery', images: [] };
    case 'form':
      return { type: 'form', formId: 0 };
    case 'button':
      return { type: 'button', text: 'Кнопка', url: '#', style: 'primary', align: 'left', target: '_self' };
    case 'divider':
      return { type: 'divider' };
    case 'quote':
      return { type: 'quote', text: '', author: '' };
    case 'list':
      return { type: 'list', items: [], ordered: false };
    case 'html':
      return { type: 'html', html: '' };
    case 'services':
      return { type: 'services' };
    case 'cases':
      return { type: 'cases', limit: 0, filters: false };
  }
}

export function createColumn(): PageColumn {
  return { id: newUid('col'), blocks: [] };
}

export function createSection(columns: 1 | 2 | 3 | 4 = 1): PageSection {
  const cols: PageColumn[] = [];
  for (let i = 0; i < columns; i += 1) {
    cols.push(createColumn());
  }
  return {
    id: newUid('sec'),
    columns,
    gap: 'normal',
    background: 'default',
    align: 'top',
    cols,
    widths: defaultWidths(columns),
  };
}

/** Равные веса колонок. */
export function defaultWidths(count: number): number[] {
  return Array.from({ length: Math.max(1, count) }, () => 1);
}

/** Веса колонок: целые 1–100, длина подгоняется под число колонок. */
export function normalizeWidths(value: unknown, count: number): number[] {
  const arr = Array.isArray(value) ? value : [];
  const out: number[] = [];
  for (let i = 0; i < Math.max(1, count); i += 1) {
    out.push(clampInt(arr[i] ?? 1, 1, 100));
  }
  return out;
}

/** CSS для grid-template-columns по весам; null — колонки равные (по умолчанию). */
export function widthsStyle(widths: number[] | undefined, count: number): string | null {
  if (!Array.isArray(widths) || widths.length !== count || count < 2) {
    return null;
  }
  if (widths.every((w) => w === widths[0])) {
    return null;
  }
  return widths.map((w) => `${w}fr`).join(' ');
}

export function normalizePageContent(content: unknown): PageContent {
  if (!Array.isArray(content)) {
    return [];
  }
  if (content.length === 0) {
    return [];
  }

  // Новая структура: массив секций
  const first = content[0] as Record<string, unknown>;
  if (first && typeof first === 'object' && Array.isArray(first['cols'])) {
    return content
      .map((raw) => normalizeSection(raw as Record<string, unknown>))
      .filter((s): s is PageSection => s !== null);
  }

  // Старая структура: плоский массив блоков → одна секция с одной колонкой
  const blocks = content
    .map((raw) => normalizeBlock(raw as Record<string, unknown>))
    .filter((b): b is PageBlock => b !== null);
  if (blocks.length === 0) {
    return [];
  }
  const column = createColumn();
  column.blocks = blocks;
  const section = createSection(1);
  section.cols = [column];
  return [section];
}

function normalizeSection(raw: Record<string, unknown>): PageSection | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw['cols'])) {
    return null;
  }
  const rawCols = raw['cols'] as Array<Record<string, unknown>>;
  const cols: PageColumn[] = rawCols.map((colRaw, i) => {
    const col: PageColumn = {
      id: typeof colRaw?.['id'] === 'string' && colRaw['id'] ? colRaw['id'] : newUid('col'),
      blocks: Array.isArray(colRaw?.['blocks'])
        ? (colRaw['blocks'] as Array<Record<string, unknown>>)
            .map((b) => normalizeBlock(b))
            .filter((b): b is PageBlock => b !== null)
        : [],
    };
    if (!col.id) {
      col.id = `col-${i}`;
    }
    return col;
  });

  if (cols.length === 0) {
    cols.push(createColumn());
  }

  const numColumns = clampInt(raw['columns'], 1, 4);
  // Если колонок больше, чем заявлено — дополняем
  while (cols.length < numColumns) {
    cols.push(createColumn());
  }
  // Если колонок больше заявленного числа — не обрезаем, а подгоняем число колонок
  const columns = Math.max(numColumns, cols.length) as 1 | 2 | 3 | 4;

  return {
    id: typeof raw['id'] === 'string' && raw['id'] ? raw['id'] : newUid('sec'),
    columns,
    gap: normalizeGap(raw['gap']),
    background: normalizeBg(raw['background']),
    align: raw['align'] === 'middle' || raw['align'] === 'bottom' ? raw['align'] : 'top',
    cols,
    widths: normalizeWidths(raw['widths'], columns),
  };
}

function normalizeBlock(raw: Record<string, unknown>): PageBlock | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const type = raw['type'];
  switch (type) {
    case 'text':
      return {
        type: 'text',
        text: str(raw['text']),
        align: normalizeAlign(raw['align']),
        fontSize: optStr(raw['fontSize']),
        fontFamily: optStr(raw['fontFamily']),
      };
    case 'heading': {
      const level =
        raw['level'] === 'h1' || raw['level'] === 'h3' || raw['level'] === 'h4' ? raw['level'] : 'h2';
      return {
        type: 'heading',
        text: str(raw['text']),
        level,
        align: normalizeAlign(raw['align']),
        fontSize: optStr(raw['fontSize']),
        fontFamily: optStr(raw['fontFamily']),
      };
    }
    case 'image':
      return {
        type: 'image',
        url: str(raw['url']),
        alt: raw['alt'] != null ? str(raw['alt']) : '',
        caption: raw['caption'] != null ? str(raw['caption']) : '',
        align: normalizeAlign(raw['align']),
        width: raw['width'] != null ? str(raw['width']) : 'auto',
      };
    case 'gallery': {
      const columns = raw['columns'] != null ? clampInt(raw['columns'], 2, 4) : undefined;
      return {
        type: 'gallery',
        images: Array.isArray(raw['images']) ? raw['images'].filter((i): i is string => typeof i === 'string') : [],
        ...(columns !== undefined ? { columns } : {}),
      };
    }
    case 'form':
      return { type: 'form', formId: Number(raw['formId']) || 0, width: optStr(raw['width']) };
    case 'button':
      return {
        type: 'button',
        text: str(raw['text']),
        url: str(raw['url']),
        style: raw['style'] === 'outline' || raw['style'] === 'ghost' ? raw['style'] : 'primary',
        align: normalizeAlign(raw['align']),
        target: raw['target'] === '_blank' ? '_blank' : '_self',
      };
    case 'divider':
      return { type: 'divider' };
    case 'quote':
      return {
        type: 'quote',
        text: str(raw['text']),
        author: raw['author'] != null ? str(raw['author']) : '',
      };
    case 'list':
      return {
        type: 'list',
        items: Array.isArray(raw['items']) ? raw['items'].filter((i): i is string => typeof i === 'string') : [],
        ordered: raw['ordered'] === true,
      };
    case 'html':
      return { type: 'html', html: str(raw['html']) };
    case 'services':
      return { type: 'services' };
    case 'cases':
      return {
        type: 'cases',
        limit: clampInt(raw['limit'] ?? 0, 0, 48),
        filters: raw['filters'] === true,
      };
    default:
      return null;
  }
}

function normalizeAlign(v: unknown): 'left' | 'center' | 'right' {
  return v === 'center' || v === 'right' ? v : 'left';
}

function normalizeGap(v: unknown): PageSectionGap {
  return v === 'none' || v === 'small' || v === 'large' ? v : 'normal';
}

function normalizeBg(v: unknown): PageSectionBg {
  return v === 'light' || v === 'dark' || v === 'accent' || v === 'hero' ? v : 'default';
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Необязательное строковое значение: пустое → undefined. */
function optStr(v: unknown): string | undefined {
  const s = str(v).trim();
  return s === '' ? undefined : s;
}

/** Имя блока для отображения */
export function blockLabel(type: PageBlock['type']): string {
  switch (type) {
    case 'text':
      return 'Текст';
    case 'heading':
      return 'Заголовок';
    case 'image':
      return 'Изображение';
    case 'gallery':
      return 'Галерея';
    case 'form':
      return 'Форма';
    case 'button':
      return 'Кнопка';
    case 'divider':
      return 'Разделитель';
    case 'quote':
      return 'Цитата';
    case 'list':
      return 'Список';
    case 'html':
      return 'HTML';
    case 'services':
      return 'Услуги';
    case 'cases':
      return 'Кейсы';
  }
}

export const BLOCK_TYPES: Array<{ type: PageBlock['type']; label: string; icon: string }> = [
  { type: 'text', label: 'Текст', icon: '¶' },
  { type: 'heading', label: 'Заголовок', icon: 'H' },
  { type: 'image', label: 'Изображение', icon: '▧' },
  { type: 'gallery', label: 'Галерея', icon: '▤' },
  { type: 'form', label: 'Форма', icon: '☰' },
  { type: 'button', label: 'Кнопка', icon: '⬒' },
  { type: 'divider', label: 'Разделитель', icon: '—' },
  { type: 'quote', label: 'Цитата', icon: '❝' },
  { type: 'list', label: 'Список', icon: '☷' },
  { type: 'html', label: 'HTML', icon: '</>' },
  { type: 'services', label: 'Услуги', icon: '▦' },
  { type: 'cases', label: 'Кейсы', icon: '▩' },
];

/** Слаги страниц со статическими маршрутами (плюс главная). */
const STATIC_PAGE_SLUGS = [
  'home',
  'services',
  'portfolio',
  'about',
  'partners',
  'contacts',
  'policy',
  'terms',
  'cookie-policy',
];

/** Публичный адрес страницы по её записи из БД. */
export function pageHref(page: Page): string {
  if (page.slug === 'home') {
    return '/';
  }
  if (STATIC_PAGE_SLUGS.includes(page.slug)) {
    return `/${page.slug}`;
  }
  return `/pages/${page.slug}`;
}
