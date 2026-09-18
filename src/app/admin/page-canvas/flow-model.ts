import {
  PageBlock,
  PageColumn,
  PageContent,
  PageSection,
  PageSectionBg,
  PageSectionGap,
} from '../../models/admin.model';
import { createColumn, createSection, newUid, normalizeWidths } from '../../utils/page-content.util';

/** Блок в потоке канваса: uid нужен только интерфейсу редактора. */
export interface FlowBlock {
  kind: 'block';
  uid: string;
  block: PageBlock;
}

/** Контейнер «Секция»: фон, отступы, выравнивание, колонки и их соотношение. */
export interface FlowSection {
  kind: 'section';
  uid: string;
  sectionId: string;
  background: PageSectionBg;
  gap: PageSectionGap;
  align: 'top' | 'middle' | 'bottom';
  cols: FlowBlock[][];
  /** Веса колонок (1–100). */
  widths: number[];
}

export type FlowItem = FlowBlock | FlowSection;

export function makeFlowBlock(block: PageBlock): FlowBlock {
  return { kind: 'block', uid: newUid('fb'), block };
}

export function makeFlowSection(): FlowSection {
  return {
    kind: 'section',
    uid: newUid('fs'),
    sectionId: newUid('sec'),
    background: 'default',
    gap: 'normal',
    align: 'top',
    cols: [[]],
    widths: [1],
  };
}

/** «Простая» секция: одна колонка без фона и особых настроек — разворачивается в поток. */
export function isPlainSection(sec: PageSection): boolean {
  return (
    sec.columns === 1 &&
    sec.background === 'default' &&
    sec.gap === 'normal' &&
    sec.align === 'top'
  );
}

/** Хранение (секции → колонки → блоки) → плоский поток канваса. */
export function sectionsToFlow(sections: PageSection[]): FlowItem[] {
  const flow: FlowItem[] = [];
  for (const sec of sections) {
    if (isPlainSection(sec)) {
      for (const col of sec.cols) {
        for (const block of col.blocks) {
          flow.push(makeFlowBlock(block));
        }
      }
      continue;
    }
    flow.push({
      kind: 'section',
      uid: newUid('fs'),
      sectionId: sec.id,
      background: sec.background,
      gap: sec.gap,
      align: sec.align,
      cols: sec.cols.map((col) => col.blocks.map((block) => makeFlowBlock(block))),
      widths: normalizeWidths(sec.widths, sec.cols.length),
    });
  }
  return flow;
}

/** Плоский поток канваса → хранение: соседние обычные блоки собираются в секцию. */
export function flowToSections(flow: FlowItem[]): PageContent {
  const sections: PageSection[] = [];
  let plain: PageBlock[] = [];

  const flushPlain = (): void => {
    if (plain.length === 0) {
      return;
    }
    const col = createColumn();
    col.blocks = plain;
    const sec = createSection(1);
    sec.cols = [col];
    sections.push(sec);
    plain = [];
  };

  for (const item of flow) {
    if (item.kind === 'block') {
      plain.push(item.block);
      continue;
    }
    flushPlain();
    const cols: PageColumn[] = item.cols.map((blocks) => {
      const col = createColumn();
      col.blocks = blocks.map((fb) => fb.block);
      return col;
    });
    if (cols.length === 0) {
      cols.push(createColumn());
    }
    sections.push({
      id: item.sectionId || newUid('sec'),
      columns: Math.min(4, Math.max(1, cols.length)) as 1 | 2 | 3 | 4,
      gap: item.gap,
      background: item.background,
      align: item.align,
      cols,
      widths: normalizeWidths(item.widths, cols.length),
    });
  }
  flushPlain();
  return sections;
}

/** Изменение числа колонок: лишние колонки сворачиваются в последнюю, блоки не теряются. */
export function resizeSectionCols(cols: FlowBlock[][], count: number): FlowBlock[][] {
  const n = Math.min(4, Math.max(1, Math.floor(count)));
  const next = cols.slice(0, n);
  while (next.length < n) {
    next.push([]);
  }
  for (const removed of cols.slice(n)) {
    next[next.length - 1].push(...removed);
  }
  return next;
}
