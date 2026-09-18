import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  Output,
} from '@angular/core';
import { AdminMediaPickerComponent } from '../../admin-media-picker/admin-media-picker.component';
import { Form, PageBlock, TextAlign } from '../../../models/admin.model';
import { blockLabel } from '../../../utils/page-content.util';
import { FlowBlock } from '../flow-model';
import { CanvasTextComponent } from '../canvas-text/canvas-text.component';
import { FormRenderComponent } from '../../../components/form-render/form-render.component';
import { ServicesGridComponent } from '../../../components/services-grid/services-grid.component';
import { CasesGridComponent } from '../../../components/cases-grid/cases-grid.component';

/** Один блок канваса: редактирование на месте, гуттер, меню и поповер настроек. */
@Component({
  selector: 'app-canvas-block',
  imports: [CanvasTextComponent, AdminMediaPickerComponent, FormRenderComponent, ServicesGridComponent, CasesGridComponent],
  templateUrl: './canvas-block.component.html',
  styleUrl: './canvas-block.component.scss',
  host: {
    '(document:mousedown)': 'onDocumentMousedown($event)',
    '(document:keydown.escape)': 'closeMenus()',
  },
})
export class CanvasBlockComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) block!: FlowBlock;
  @Input() forms: Form[] = [];
  @Input() selected = false;
  @Input() autofocus = false;

  @Output() readonly change = new EventEmitter<void>();
  @Output() readonly remove = new EventEmitter<void>();
  @Output() readonly duplicate = new EventEmitter<void>();
  @Output() readonly plusClick = new EventEmitter<{ left: number; top: number }>();
  @Output() readonly newBlockAfter = new EventEmitter<void>();
  @Output() readonly removeEmpty = new EventEmitter<void>();
  @Output() readonly slash = new EventEmitter<{ left: number; top: number }>();

  menuOpen = false;
  settingsOpen = false;
  pickerOpen = false;
  pickerMode: 'image' | 'gallery' = 'image';

  /** Варианты размера текста (в пикселях). */
  readonly fontSizes: Array<{ value: string; label: string }> = [
    { value: '', label: 'Как на сайте' },
    { value: '14px', label: '14 px' },
    { value: '16px', label: '16 px' },
    { value: '18px', label: '18 px' },
    { value: '20px', label: '20 px' },
    { value: '24px', label: '24 px' },
    { value: '28px', label: '28 px' },
    { value: '32px', label: '32 px' },
    { value: '40px', label: '40 px' },
    { value: '48px', label: '48 px' },
    { value: '56px', label: '56 px' },
    { value: '64px', label: '64 px' },
  ];

  /** Варианты шрифта: системные наборы (без внешних загрузок). */
  readonly fontFamilies: Array<{ value: string; label: string }> = [
    { value: '', label: 'Как на сайте' },
    { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', label: 'Системный' },
    { value: 'Georgia, "Times New Roman", Times, serif', label: 'С засечками' },
    { value: 'Consolas, Menlo, Monaco, "Courier New", monospace', label: 'Монospace' },
  ];

  /** Пресеты ширины (изображение, форма). */
  readonly widthPresets: Array<{ value: string; label: string }> = [
    { value: 'auto', label: 'Авто' },
    { value: '100%', label: 'На всю ширину' },
    { value: '480px', label: '480 px' },
    { value: '320px', label: '320 px' },
  ];

  /** Значение для поля «Своя ширина»: пусто, если выбрано из пресетов. */
  customWidth(value: string): string {
    return this.widthPresets.some((p) => p.value === value) ? '' : value;
  }

  // ---- Общее ----

  get type(): PageBlock['type'] {
    return this.block.block.type;
  }

  get typeLabel(): string {
    return blockLabel(this.block.block.type);
  }

  get align(): TextAlign {
    const b = this.block.block;
    if (b.type === 'text' || b.type === 'heading' || b.type === 'image' || b.type === 'button') {
      return b.align ?? 'left';
    }
    return 'left';
  }

  setAlign(value: string): void {
    const b = this.block.block;
    if (b.type === 'text' || b.type === 'heading' || b.type === 'image' || b.type === 'button') {
      b.align = value === 'center' || value === 'right' ? value : 'left';
      this.emit();
    }
  }

  alignClass(): string {
    const a = this.align;
    return a === 'left' ? '' : `pc-block--align-${a}`;
  }

  // ---- Шрифт текста и заголовка ----

  get fontSize(): string | null {
    const b = this.block.block;
    if (b.type === 'text' || b.type === 'heading') {
      return b.fontSize ?? null;
    }
    return null;
  }

  get fontFamily(): string | null {
    const b = this.block.block;
    if (b.type === 'text' || b.type === 'heading') {
      return b.fontFamily ?? null;
    }
    return null;
  }

  setFontSize(value: string): void {
    const b = this.block.block;
    if (b.type === 'text' || b.type === 'heading') {
      b.fontSize = value || undefined;
      this.emit();
    }
  }

  setFontFamily(value: string): void {
    const b = this.block.block;
    if (b.type === 'text' || b.type === 'heading') {
      b.fontFamily = value || undefined;
      this.emit();
    }
  }

  // ---- Меню блока ----

  toggleMenu(event: MouseEvent): void {
    this.menuOpen = !this.menuOpen;
    this.settingsOpen = false;
    this.cdr.markForCheck();
  }

  onPlus(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.plusClick.emit({ left: rect.left, top: rect.bottom + 4 });
  }

  openSettings(): void {
    this.menuOpen = false;
    this.settingsOpen = true;
    this.cdr.markForCheck();
  }

  closeMenus(): void {
    if (!this.menuOpen && !this.settingsOpen) {
      return;
    }
    this.menuOpen = false;
    this.settingsOpen = false;
    this.cdr.markForCheck();
  }

  onDocumentMousedown(event: MouseEvent): void {
    const host = this.hostRef.nativeElement;
    if (!host.contains(event.target as Node)) {
      this.closeMenus();
    }
  }

  // ---- Текст / заголовок / цитата ----

  get textValue(): string {
    const b = this.block.block;
    if (b.type === 'text' || b.type === 'heading' || b.type === 'quote') {
      return b.text;
    }
    return '';
  }

  onTextChange(value: string): void {
    const b = this.block.block;
    if (b.type === 'text' || b.type === 'heading' || b.type === 'quote') {
      b.text = value;
      this.emit();
    }
  }

  get headingLevel(): 'h1' | 'h2' | 'h3' | 'h4' {
    const b = this.block.block;
    return b.type === 'heading' ? b.level : 'h2';
  }

  setLevel(value: string): void {
    const b = this.block.block;
    if (b.type === 'heading') {
      b.level = value === 'h1' || value === 'h3' || value === 'h4' ? value : 'h2';
      this.emit();
    }
  }

  get quoteAuthor(): string {
    const b = this.block.block;
    return b.type === 'quote' ? (b.author ?? '') : '';
  }

  onQuoteAuthor(value: string): void {
    const b = this.block.block;
    if (b.type === 'quote') {
      b.author = value;
      this.emit();
    }
  }

  // ---- Список ----

  get listItems(): string[] {
    const b = this.block.block;
    return b.type === 'list' ? b.items : [];
  }

  get listOrdered(): boolean {
    const b = this.block.block;
    return b.type === 'list' ? !!b.ordered : false;
  }

  onListItems(items: string[]): void {
    const b = this.block.block;
    if (b.type === 'list') {
      b.items = items;
      this.emit();
    }
  }

  onListOrdered(value: boolean): void {
    const b = this.block.block;
    if (b.type === 'list') {
      b.ordered = value;
      this.emit();
    }
  }

  // ---- Изображение ----

  get imageUrl(): string {
    const b = this.block.block;
    return b.type === 'image' ? b.url : '';
  }

  get imageAlt(): string {
    const b = this.block.block;
    return b.type === 'image' ? (b.alt ?? '') : '';
  }

  get imageCaption(): string {
    const b = this.block.block;
    return b.type === 'image' ? (b.caption ?? '') : '';
  }

  get imageWidth(): string {
    const b = this.block.block;
    return b.type === 'image' ? (b.width ?? 'auto') : 'auto';
  }

  imageMaxWidth(): string | null {
    const w = this.imageWidth;
    return w !== 'auto' && w !== '100%' ? w : null;
  }

  setImageField(field: 'url' | 'alt' | 'caption' | 'width', value: string): void {
    const b = this.block.block;
    if (b.type === 'image') {
      if (field === 'width') {
        b.width = value.trim() === '' ? 'auto' : value.trim();
      } else {
        b[field] = value;
      }
      this.emit();
    }
  }

  // ---- Галерея ----

  get galleryImages(): string[] {
    const b = this.block.block;
    return b.type === 'gallery' ? b.images : [];
  }

  get galleryColumns(): number | null {
    const b = this.block.block;
    return b.type === 'gallery' && b.columns ? b.columns : null;
  }

  setGalleryColumns(value: string): void {
    const b = this.block.block;
    if (b.type !== 'gallery') {
      return;
    }
    const n = Number(value);
    if (value === '' || !Number.isFinite(n)) {
      delete b.columns;
    } else {
      b.columns = Math.min(4, Math.max(2, Math.floor(n)));
    }
    this.emit();
  }

  removeGalleryImage(index: number): void {
    const b = this.block.block;
    if (b.type === 'gallery') {
      b.images = b.images.filter((_, i) => i !== index);
      this.emit();
    }
  }

  // ---- Кнопка ----

  get buttonText(): string {
    const b = this.block.block;
    return b.type === 'button' ? b.text : '';
  }

  get buttonUrl(): string {
    const b = this.block.block;
    return b.type === 'button' ? b.url : '';
  }

  get buttonStyle(): string {
    const b = this.block.block;
    return b.type === 'button' ? b.style : 'primary';
  }

  get buttonTarget(): string {
    const b = this.block.block;
    return b.type === 'button' ? (b.target ?? '_self') : '_self';
  }

  setButtonField(field: 'text' | 'url' | 'style' | 'target', value: string): void {
    const b = this.block.block;
    if (b.type !== 'button') {
      return;
    }
    if (field === 'style') {
      b.style = value === 'outline' || value === 'ghost' ? value : 'primary';
    } else if (field === 'target') {
      b.target = value === '_blank' ? '_blank' : '_self';
    } else {
      b[field] = value;
    }
    this.emit();
  }

  // ---- Форма ----

  get formId(): number {
    const b = this.block.block;
    return b.type === 'form' ? b.formId : 0;
  }

  formTitle(id: number): string {
    const form = this.forms.find((f) => f.id === id);
    return form ? `№${form.form_number} — ${form.title}` : 'не выбрана';
  }

  setFormId(value: string): void {
    const b = this.block.block;
    if (b.type === 'form') {
      b.formId = Number(value) || 0;
      this.emit();
    }
  }

  get formWidth(): string {
    const b = this.block.block;
    return b.type === 'form' ? (b.width ?? 'auto') : 'auto';
  }

  formMaxWidth(): string | null {
    const w = this.formWidth;
    return w !== 'auto' && w !== '100%' ? w : null;
  }

  setFormWidth(value: string): void {
    const b = this.block.block;
    if (b.type === 'form') {
      b.width = value.trim() === '' ? 'auto' : value.trim();
      this.emit();
    }
  }

  // ---- HTML ----

  get htmlValue(): string {
    const b = this.block.block;
    return b.type === 'html' ? b.html : '';
  }

  onHtml(value: string): void {
    const b = this.block.block;
    if (b.type === 'html') {
      b.html = value;
      this.emit();
    }
  }

  // ---- Каталоги (услуги / кейсы) ----

  get casesLimit(): number {
    const b = this.block.block;
    return b.type === 'cases' ? (b.limit ?? 0) : 0;
  }

  get casesFilters(): boolean {
    const b = this.block.block;
    return b.type === 'cases' ? b.filters === true : false;
  }

  setCasesLimit(value: string): void {
    const b = this.block.block;
    if (b.type === 'cases') {
      b.limit = Math.min(48, Math.max(0, Math.floor(Number(value) || 0)));
      this.emit();
    }
  }

  setCasesFilters(value: boolean): void {
    const b = this.block.block;
    if (b.type === 'cases') {
      b.filters = value;
      this.emit();
    }
  }

  // ---- Медиатека ----

  openPicker(mode: 'image' | 'gallery'): void {
    this.pickerMode = mode;
    this.pickerOpen = true;
    this.cdr.markForCheck();
  }

  onPick(url: string): void {
    const b = this.block.block;
    if (this.pickerMode === 'image' && b.type === 'image') {
      b.url = url;
      this.emit();
    } else if (this.pickerMode === 'gallery' && b.type === 'gallery') {
      b.images = [...b.images, url];
      this.emit();
    }
    this.pickerOpen = false;
    this.cdr.markForCheck();
  }

  closePicker(): void {
    this.pickerOpen = false;
    this.cdr.markForCheck();
  }

  // ---- Служебное ----

  emit(): void {
    this.change.emit();
    this.cdr.markForCheck();
  }
}
