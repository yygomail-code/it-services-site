import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Form, PageBlock, PageContent, PageSectionBg, PageSectionGap } from '../../models/admin.model';
import {
  BLOCK_TYPES,
  createEmptyBlock,
  defaultWidths,
  normalizeWidths,
  widthsStyle,
} from '../../utils/page-content.util';
import {
  FlowBlock,
  FlowItem,
  FlowSection,
  flowToSections,
  makeFlowBlock,
  makeFlowSection,
  resizeSectionCols,
  sectionsToFlow,
} from './flow-model';
import { CanvasBlockComponent } from './canvas-block/canvas-block.component';

interface InsertMenuState {
  mode: 'insert' | 'convert';
  targetUid: string | null;
  sectionUid: string | null;
  colIdx: number | null;
  left: number;
  top: number;
}

interface DropTarget {
  kind: 'block-before' | 'block-after' | 'col' | 'flow-end';
  uid: string | null;
  sectionUid: string | null;
  colIdx: number | null;
}

interface DragState {
  uid: string;
  kind: 'block' | 'section';
}

type MenuKey = PageBlock['type'] | 'section';

/**
 * Канвас страницы: плоский поток блоков и контейнеров «Секция».
 * Правка на месте, перетаскивание, вставка «+»/«/», поповеры настроек,
 * история (Ctrl+Z) и автосохранение черновика на стороне страницы.
 */
@Component({
  selector: 'app-page-canvas',
  imports: [CanvasBlockComponent],
  templateUrl: './page-canvas.component.html',
  styleUrl: './page-canvas.component.scss',
  host: {
    '(document:mousedown)': 'onDocumentMousedown($event)',
    '(document:keydown)': 'onDocumentKeydown($event)',
    '(document:mousemove)': 'onDocumentMousemove($event)',
    '(document:mouseup)': 'onDocumentMouseup()',
  },
})
export class PageCanvasComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  @Input() sections: PageContent = [];
  @Input() forms: Form[] = [];

  @Output() readonly sectionsChange = new EventEmitter<PageContent>();
  @Output() readonly change = new EventEmitter<void>();

  items: FlowItem[] = [];
  selectedUid: string | null = null;
  focusUid: string | null = null;

  insertMenu: InsertMenuState | null = null;
  sectionSettingsUid: string | null = null;

  dropTarget: DropTarget | null = null;
  dragState: DragState | null = null;

  /** Перетаскивание границы между колонками секции. */
  resizeState: { sectionUid: string; colIdx: number; startX: number; leftWidth: number; rightWidth: number } | null = null;

  readonly menuItems: Array<{ key: MenuKey; label: string; icon: string }> = [
    ...BLOCK_TYPES.map((t) => ({ key: t.type as MenuKey, label: t.label, icon: t.icon })),
    { key: 'section', label: 'Секция', icon: '▭' },
  ];

  private lastEmitted: PageContent | null = null;
  private history: string[] = [];
  private histIndex = -1;
  private lastPush = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sections'] && this.sections !== this.lastEmitted) {
      this.items = sectionsToFlow(this.sections ?? []);
      this.selectedUid = null;
      this.history = [];
      this.histIndex = -1;
      this.pushHistory(0);
      this.cdr.markForCheck();
    }
  }

  // ---- Выбор и служебное ----

  select(uid: string): void {
    if (this.selectedUid !== uid) {
      this.selectedUid = uid;
      this.cdr.markForCheck();
    }
  }

  isSelected(uid: string): boolean {
    return this.selectedUid === uid;
  }

  bgLabel(bg: PageSectionBg): string {
    switch (bg) {
      case 'light':
        return 'светлый';
      case 'dark':
        return 'тёмный';
      case 'accent':
        return 'акцент';
      case 'hero':
        return 'градиент';
      default:
        return 'обычный';
    }
  }

  gapLabel(gap: PageSectionGap): string {
    switch (gap) {
      case 'none':
        return 'без отступов';
      case 'small':
        return 'малые';
      case 'large':
        return 'большие';
      default:
        return 'обычные';
    }
  }

  /** Первый блок группы обычных блоков (на сайте — начало обычной секции). */
  isRunStart(index: number): boolean {
    const item = this.items[index];
    return !!item && item.kind === 'block' && (index === 0 || this.items[index - 1].kind === 'section');
  }

  /** Последний блок группы обычных блоков (на сайте — конец обычной секции). */
  isRunEnd(index: number): boolean {
    const item = this.items[index];
    return (
      !!item &&
      item.kind === 'block' &&
      (index === this.items.length - 1 || this.items[index + 1].kind === 'section')
    );
  }

  // ---- Изменения ----

  /** Коммит: снимок истории (с коалесцированием для правок текста) и событие наружу. */
  commit(coalesceMs = 0): void {
    this.pushHistory(coalesceMs);
    const sections = flowToSections(this.items);
    this.lastEmitted = sections;
    this.sectionsChange.emit(sections);
    this.change.emit();
    this.cdr.markForCheck();
  }

  onBlockChange(): void {
    this.commit(900);
  }

  private pushHistory(coalesceMs: number): void {
    const snap = JSON.stringify(this.items);
    if (this.histIndex >= 0 && this.history[this.histIndex] === snap) {
      return;
    }
    const now = Date.now();
    if (coalesceMs > 0 && this.histIndex >= 0 && now - this.lastPush < coalesceMs) {
      this.history[this.histIndex] = snap;
      this.lastPush = now;
      return;
    }
    this.history = this.history.slice(0, this.histIndex + 1);
    this.history.push(snap);
    this.histIndex = this.history.length - 1;
    this.lastPush = now;
    if (this.history.length > 120) {
      this.history.shift();
      this.histIndex -= 1;
    }
  }

  private restoreSnapshot(): void {
    const snap = this.history[this.histIndex];
    if (!snap) {
      return;
    }
    this.items = JSON.parse(snap) as FlowItem[];
    this.insertMenu = null;
    this.sectionSettingsUid = null;
    const sections = flowToSections(this.items);
    this.lastEmitted = sections;
    this.sectionsChange.emit(sections);
    this.change.emit();
    this.cdr.markForCheck();
  }

  undo(): void {
    if (this.histIndex > 0) {
      this.histIndex -= 1;
      this.restoreSnapshot();
    }
  }

  redo(): void {
    if (this.histIndex < this.history.length - 1) {
      this.histIndex += 1;
      this.restoreSnapshot();
    }
  }

  // ---- Поиск блоков ----

  private locateBlock(uid: string): { list: FlowItem[]; index: number } | null {
    for (const item of this.items) {
      if (item.kind === 'block' && item.uid === uid) {
        return { list: this.items, index: this.items.indexOf(item) };
      }
      if (item.kind === 'section') {
        for (const col of item.cols) {
          const idx = col.findIndex((b) => b.uid === uid);
          if (idx >= 0) {
            return { list: col as FlowItem[], index: idx };
          }
        }
      }
    }
    return null;
  }

  private findSection(uid: string): FlowSection | null {
    const item = this.items.find((i) => i.kind === 'section' && i.uid === uid);
    return item && item.kind === 'section' ? item : null;
  }

  // ---- Действия с блоками ----

  removeBlock(uid: string): void {
    const loc = this.locateBlock(uid);
    if (!loc) {
      return;
    }
    loc.list.splice(loc.index, 1);
    const next = loc.list[Math.min(loc.index, loc.list.length - 1)];
    this.selectedUid = next ? next.uid : null;
    this.commit();
  }

  duplicateBlock(uid: string): void {
    const loc = this.locateBlock(uid);
    if (!loc) {
      return;
    }
    const source = loc.list[loc.index];
    if (!source || source.kind !== 'block') {
      return;
    }
    const clone = makeFlowBlock(JSON.parse(JSON.stringify(source.block)) as PageBlock);
    loc.list.splice(loc.index + 1, 0, clone);
    this.selectedUid = clone.uid;
    this.commit();
  }

  newBlockAfter(uid: string): void {
    const loc = this.locateBlock(uid);
    if (!loc) {
      return;
    }
    const created = makeFlowBlock(createEmptyBlock('text'));
    loc.list.splice(loc.index + 1, 0, created);
    this.selectedUid = created.uid;
    this.focusSoon(created.uid);
    this.commit();
  }

  removeEmptyBlock(uid: string): void {
    const loc = this.locateBlock(uid);
    if (!loc) {
      return;
    }
    const prev = loc.index > 0 ? loc.list[loc.index - 1] : null;
    loc.list.splice(loc.index, 1);
    this.selectedUid = prev ? prev.uid : null;
    if (prev) {
      this.focusSoon(prev.uid);
    }
    this.commit();
  }

  private focusSoon(uid: string): void {
    this.focusUid = uid;
    window.setTimeout(() => {
      this.focusUid = null;
    }, 400);
  }

  isFocusTarget(uid: string): boolean {
    return this.focusUid === uid;
  }

  // ---- Действия с секциями ----

  addSection(): void {
    const section = makeFlowSection();
    this.items.push(section);
    this.selectedUid = section.uid;
    this.commit();
  }

  removeSection(uid: string): void {
    const idx = this.items.findIndex((i) => i.uid === uid);
    if (idx < 0) {
      return;
    }
    this.items.splice(idx, 1);
    this.selectedUid = null;
    this.sectionSettingsUid = null;
    this.commit();
  }

  duplicateSection(uid: string): void {
    const idx = this.items.findIndex((i) => i.uid === uid);
    if (idx < 0) {
      return;
    }
    const source = this.items[idx];
    if (source.kind !== 'section') {
      return;
    }
    const copy = JSON.parse(JSON.stringify(source)) as FlowSection;
    copy.uid = makeFlowSection().uid;
    copy.sectionId = makeFlowSection().sectionId;
    for (const col of copy.cols) {
      for (const fb of col) {
        fb.uid = makeFlowBlock(createEmptyBlock('text')).uid;
      }
    }
    this.items.splice(idx + 1, 0, copy);
    this.selectedUid = copy.uid;
    this.commit();
  }

  toggleSectionSettings(uid: string): void {
    this.sectionSettingsUid = this.sectionSettingsUid === uid ? null : uid;
    this.insertMenu = null;
    this.cdr.markForCheck();
  }

  setSectionBg(uid: string, value: string): void {
    const sec = this.findSection(uid);
    if (!sec) {
      return;
    }
    sec.background = (['light', 'dark', 'accent', 'hero'].includes(value) ? value : 'default') as PageSectionBg;
    this.commit();
  }

  setSectionGap(uid: string, value: string): void {
    const sec = this.findSection(uid);
    if (!sec) {
      return;
    }
    sec.gap = (['none', 'small', 'large'].includes(value) ? value : 'normal') as PageSectionGap;
    this.commit();
  }

  setSectionAlign(uid: string, value: string): void {
    const sec = this.findSection(uid);
    if (!sec) {
      return;
    }
    sec.align = value === 'middle' || value === 'bottom' ? value : 'top';
    this.commit();
  }

  setSectionColumns(uid: string, value: number | string): void {
    const sec = this.findSection(uid);
    if (!sec) {
      return;
    }
    sec.cols = resizeSectionCols(sec.cols, Number(value) || 1);
    sec.widths = normalizeWidths(sec.widths, sec.cols.length);
    this.commit();
  }

  // ---- Соотношение колонок ----

  /** CSS соотношения колонок для канваса (null — равные). */
  widthsCss(sec: FlowSection): string | null {
    return widthsStyle(sec.widths, sec.cols.length);
  }

  widthAt(sec: FlowSection, index: number): number {
    return normalizeWidths(sec.widths, sec.cols.length)[index] ?? 1;
  }

  widthPercent(sec: FlowSection, index: number): number {
    const widths = normalizeWidths(sec.widths, sec.cols.length);
    const total = widths.reduce((sum, w) => sum + w, 0) || 1;
    return Math.round(((widths[index] ?? 1) / total) * 100);
  }

  setSectionWidth(uid: string, index: number, value: number | string): void {
    const sec = this.findSection(uid);
    if (!sec) {
      return;
    }
    const widths = normalizeWidths(sec.widths, sec.cols.length);
    if (index < 0 || index >= widths.length) {
      return;
    }
    const next = Math.min(100, Math.max(1, Math.floor(Number(value) || 1)));
    const othersOld = widths.reduce((sum, w) => sum + w, 0) - widths[index];
    widths[index] = next;
    if (widths.length > 1) {
      const rest = 100 - next;
      for (let i = 0; i < widths.length; i += 1) {
        if (i === index) {
          continue;
        }
        widths[i] = rest > 0 && othersOld > 0 ? Math.max(1, Math.round((widths[i] * rest) / othersOld)) : 1;
      }
    }
    sec.widths = widths;
    this.commit();
  }

  equalizeWidths(uid: string): void {
    const sec = this.findSection(uid);
    if (!sec) {
      return;
    }
    sec.widths = defaultWidths(sec.cols.length);
    this.commit();
  }

  /** Старт перетаскивания границы между колонками (colIdx и colIdx + 1). */
  startColResize(event: MouseEvent, sectionUid: string, colIdx: number): void {
    event.preventDefault();
    event.stopPropagation();
    const sec = this.findSection(sectionUid);
    if (!sec || colIdx < 0 || colIdx >= sec.cols.length - 1) {
      return;
    }
    const grid = (event.currentTarget as HTMLElement).closest('.pc-grid');
    const cols = grid ? Array.from(grid.querySelectorAll<HTMLElement>(':scope > .pc-col')) : [];
    const left = cols[colIdx]?.getBoundingClientRect().width ?? 0;
    const right = cols[colIdx + 1]?.getBoundingClientRect().width ?? 0;
    if (left <= 0 || right <= 0) {
      return;
    }
    this.resizeState = {
      sectionUid,
      colIdx,
      startX: event.clientX,
      leftWidth: left,
      rightWidth: right,
    };
    this.selectedUid = null;
    this.cdr.markForCheck();
  }

  onDocumentMousemove(event: MouseEvent): void {
    if (!this.resizeState) {
      return;
    }
    const sec = this.findSection(this.resizeState.sectionUid);
    if (!sec) {
      this.resizeState = null;
      return;
    }
    const { colIdx, startX, leftWidth, rightWidth } = this.resizeState;
    const total = leftWidth + rightWidth;
    const min = 40;
    const nextLeft = Math.min(total - min, Math.max(min, leftWidth + (event.clientX - startX)));
    const ratio = nextLeft / total;

    let widths = normalizeWidths(sec.widths, sec.cols.length);
    let pairTotal = widths[colIdx] + widths[colIdx + 1];
    // Дробим веса крупнее, чтобы перетаскивание было плавным
    if (pairTotal < 20) {
      const factor = Math.max(1, Math.round(20 / pairTotal));
      widths = widths.map((w) => Math.min(100, w * factor));
      pairTotal = widths[colIdx] + widths[colIdx + 1];
    }
    const wLeft = Math.min(pairTotal - 1, Math.max(1, Math.round(ratio * pairTotal)));
    widths[colIdx] = wLeft;
    widths[colIdx + 1] = pairTotal - wLeft;
    sec.widths = widths;
    this.cdr.markForCheck();
  }

  onDocumentMouseup(): void {
    if (!this.resizeState) {
      return;
    }
    this.resizeState = null;
    this.commit();
    this.cdr.markForCheck();
  }

  // ---- Меню вставки и slash ----

  onPlus(uid: string, coords: { left: number; top: number }): void {
    this.insertMenu = { mode: 'insert', targetUid: uid, sectionUid: null, colIdx: null, left: coords.left, top: coords.top };
    this.sectionSettingsUid = null;
    this.cdr.markForCheck();
  }

  onSlash(uid: string, coords: { left: number; top: number }): void {
    this.insertMenu = { mode: 'convert', targetUid: uid, sectionUid: null, colIdx: null, left: coords.left, top: coords.top };
    this.sectionSettingsUid = null;
    this.cdr.markForCheck();
  }

  openInsertAtEnd(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.insertMenu = { mode: 'insert', targetUid: null, sectionUid: null, colIdx: null, left: rect.left, top: rect.bottom + 4 };
    this.cdr.markForCheck();
  }

  openInsertForColumn(sectionUid: string, colIdx: number, event: MouseEvent): void {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.insertMenu = {
      mode: 'insert',
      targetUid: null,
      sectionUid,
      colIdx,
      left: rect.left,
      top: rect.bottom + 4,
    };
    this.sectionSettingsUid = null;
    this.cdr.markForCheck();
  }

  closeInsertMenu(): void {
    this.insertMenu = null;
    this.cdr.markForCheck();
  }

  chooseMenuItem(key: MenuKey): void {
    const menu = this.insertMenu;
    this.insertMenu = null;
    if (!menu) {
      return;
    }

    // Преобразование текущего блока (slash-меню)
    if (menu.mode === 'convert' && menu.targetUid) {
      const loc = this.locateBlock(menu.targetUid);
      if (!loc) {
        return;
      }
      if (key === 'section') {
        loc.list.splice(loc.index, 1);
        const section = makeFlowSection();
        this.items.splice(Math.min(loc.index, this.items.length), 0, section);
        this.selectedUid = section.uid;
      } else {
        const replacement = makeFlowBlock(createEmptyBlock(key));
        loc.list.splice(loc.index, 1, replacement);
        this.selectedUid = replacement.uid;
        this.focusSoon(replacement.uid);
      }
      this.commit();
      return;
    }

    if (key === 'section') {
      const section = makeFlowSection();
      const anchorUid = menu.sectionUid ?? menu.targetUid;
      if (anchorUid) {
        const idx = this.items.findIndex((i) => i.uid === anchorUid);
        this.items.splice(idx >= 0 ? idx + 1 : this.items.length, 0, section);
      } else {
        this.items.push(section);
      }
      this.selectedUid = section.uid;
      this.commit();
      return;
    }

    const created = makeFlowBlock(createEmptyBlock(key));
    if (menu.sectionUid && menu.colIdx !== null) {
      const sec = this.findSection(menu.sectionUid);
      if (sec && sec.cols[menu.colIdx]) {
        sec.cols[menu.colIdx].push(created);
      } else {
        this.items.push(created);
      }
    } else if (menu.targetUid) {
      const loc = this.locateBlock(menu.targetUid);
      if (loc) {
        loc.list.splice(loc.index + 1, 0, created);
      } else {
        this.items.push(created);
      }
    } else {
      this.items.push(created);
    }
    this.selectedUid = created.uid;
    this.focusSoon(created.uid);
    this.commit();
  }

  onDocumentMousedown(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (this.insertMenu) {
      const menuEl = this.hostRef.nativeElement.querySelector('.canvas-insert');
      if (menuEl && !menuEl.contains(target)) {
        this.closeInsertMenu();
      }
    }

    if (this.sectionSettingsUid) {
      const inPopover = target?.closest?.('.canvas-section-pop');
      const onBar = target?.closest?.('.canvas-section-bar');
      if (!inPopover && !onBar) {
        this.sectionSettingsUid = null;
        this.cdr.markForCheck();
      }
    }
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.insertMenu = null;
      this.sectionSettingsUid = null;
      this.cdr.markForCheck();
      return;
    }

    const mod = event.ctrlKey || event.metaKey;
    if (!mod) {
      return;
    }
    const key = event.key.toLowerCase();
    const inEditor = !!(event.target as HTMLElement)?.closest?.('.ProseMirror');
    if (inEditor) {
      return;
    }
    if (key === 'z' || key === 'я') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
    } else if (key === 'y' || key === 'н') {
      event.preventDefault();
      this.redo();
    }
  }

  // ---- Перетаскивание ----

  onBlockDragStart(event: DragEvent, uid: string): void {
    if (!this.isGripDrag(event)) {
      return;
    }
    this.dragState = { uid, kind: 'block' };
    if (event.dataTransfer) {
      // Свой MIME-тип: текст в редакторы не вставляется (text/plain попал бы в контент)
      event.dataTransfer.setData('application/x-canvas-block', uid);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onSectionDragStart(event: DragEvent, uid: string): void {
    if (!this.isGripDrag(event)) {
      return;
    }
    this.dragState = { uid, kind: 'section' };
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/x-canvas-block', uid);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  /** Перетаскивание начинается только с ручки ⠿, а не с выделенного текста. */
  private isGripDrag(event: DragEvent): boolean {
    const target = event.target as HTMLElement | null;
    return !!target?.closest?.('.canvas-block__grip, .canvas-section-bar__grip');
  }

  onBlockDragOver(event: DragEvent, uid: string, sectionUid: string | null, colIdx: number | null): void {
    const drag = this.dragState;
    if (!drag || drag.uid === uid) {
      return;
    }
    if (drag.kind === 'section' && sectionUid !== null) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    this.dropTarget = {
      kind: after ? 'block-after' : 'block-before',
      uid,
      sectionUid,
      colIdx,
    };
    this.cdr.markForCheck();
  }

  onColDragOver(event: DragEvent, sectionUid: string, colIdx: number): void {
    const drag = this.dragState;
    if (!drag || drag.kind === 'section') {
      return;
    }
    event.preventDefault();
    this.dropTarget = { kind: 'col', uid: null, sectionUid, colIdx };
    this.cdr.markForCheck();
  }

  onTailDragOver(event: DragEvent): void {
    if (!this.dragState) {
      return;
    }
    event.preventDefault();
    this.dropTarget = { kind: 'flow-end', uid: null, sectionUid: null, colIdx: null };
    this.cdr.markForCheck();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const drag = this.dragState;
    const target = this.dropTarget;
    this.dragState = null;
    this.dropTarget = null;
    if (!drag || !target) {
      this.cdr.markForCheck();
      return;
    }

    if (drag.kind === 'section') {
      this.moveSectionTo(drag.uid, target);
    } else {
      this.moveBlockTo(drag.uid, target);
    }
    this.selectedUid = drag.uid;
    this.commit();
  }

  onDragEnd(): void {
    this.dragState = null;
    this.dropTarget = null;
    this.cdr.markForCheck();
  }

  private moveBlockTo(uid: string, target: DropTarget): void {
    const source = this.locateBlock(uid);
    if (!source) {
      return;
    }

    if (target.kind === 'col' && target.sectionUid) {
      const sec = this.findSection(target.sectionUid);
      if (!sec || target.colIdx === null) {
        return;
      }
      const [moved] = source.list.splice(source.index, 1);
      if (moved && moved.kind === 'block') {
        sec.cols[target.colIdx].push(moved);
      }
      return;
    }

    if (target.kind === 'flow-end') {
      const [moved] = source.list.splice(source.index, 1);
      if (moved) {
        this.items.push(moved);
      }
      return;
    }

    if (!target.uid || target.uid === uid) {
      return;
    }
    const dest = this.locateBlock(target.uid);
    if (!dest) {
      return;
    }
    let destIndex = dest.index + (target.kind === 'block-after' ? 1 : 0);
    const [moved] = source.list.splice(source.index, 1);
    if (moved && dest.list === source.list && source.index < destIndex) {
      destIndex -= 1;
    }
    if (moved) {
      dest.list.splice(destIndex, 0, moved);
    }
  }

  private moveSectionTo(uid: string, target: DropTarget): void {
    const idx = this.items.findIndex((i) => i.uid === uid);
    if (idx < 0) {
      return;
    }
    if (target.kind === 'col' || target.sectionUid !== null) {
      return;
    }
    let insertAt = this.items.length;
    if ((target.kind === 'block-before' || target.kind === 'block-after') && target.uid) {
      const topIdx = this.items.findIndex((i) => i.uid === target.uid);
      if (topIdx < 0) {
        return;
      }
      insertAt = topIdx + (target.kind === 'block-after' ? 1 : 0);
    }
    const [moved] = this.items.splice(idx, 1);
    if (moved && idx < insertAt) {
      insertAt -= 1;
    }
    if (moved) {
      this.items.splice(insertAt, 0, moved);
    }
  }
}
