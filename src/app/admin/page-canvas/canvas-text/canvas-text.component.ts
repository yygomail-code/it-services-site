import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';

export type CanvasTextVariant = 'text' | 'heading' | 'quote' | 'list';

/**
 * Текстовый редактор канваса (TipTap): правка прямо на странице.
 * Варианты: text (абзацы, H2/H3, списки, ссылки), heading (одна строка-заголовок),
 * quote (строка цитаты), list (маркированный/нумерованный список).
 */
@Component({
  selector: 'app-canvas-text',
  templateUrl: './canvas-text.component.html',
  styleUrl: './canvas-text.component.scss',
})
export class CanvasTextComponent implements AfterViewInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  @ViewChild('wrap') wrap?: ElementRef<HTMLDivElement>;

  @Input() variant: CanvasTextVariant = 'text';
  @Input() placeholder = 'Начните писать…';
  @Input() autofocus = false;

  @Output() readonly valueChange = new EventEmitter<string>();
  @Output() readonly listItemsChange = new EventEmitter<string[]>();
  @Output() readonly newBlockAfter = new EventEmitter<void>();
  @Output() readonly removeEmpty = new EventEmitter<void>();
  @Output() readonly slash = new EventEmitter<{ left: number; top: number }>();

  editor: Editor | null = null;

  bubbleOpen = false;
  bubbleLeft = 0;
  bubbleTop = 0;
  linkOpen = false;
  linkValue = '';

  private _value = '';
  private _items: string[] = [];
  private _headingLevel: 'h1' | 'h2' | 'h3' | 'h4' = 'h2';
  private _ordered = false;
  private initialized = false;
  private lastEmitted = '';

  @Input()
  set value(v: string) {
    this._value = v ?? '';
    if (this.initialized) {
      this.applyExternalContent();
    }
  }
  get value(): string {
    return this._value;
  }

  @Input()
  set items(v: string[]) {
    this._items = Array.isArray(v) ? [...v] : [];
    if (this.initialized && this.variant === 'list') {
      this.applyExternalContent();
    }
  }
  get items(): string[] {
    return this._items;
  }

  @Input()
  set headingLevel(v: 'h1' | 'h2' | 'h3' | 'h4') {
    const next = v ?? 'h2';
    if (this._headingLevel === next) {
      return;
    }
    this._headingLevel = next;
    if (this.initialized) {
      this.rebuild();
    }
  }
  get headingLevel(): 'h1' | 'h2' | 'h3' | 'h4' {
    return this._headingLevel;
  }

  @Input()
  set ordered(v: boolean) {
    const next = !!v;
    if (this._ordered === next) {
      return;
    }
    this._ordered = next;
    if (this.initialized && this.variant === 'list') {
      this.rebuild();
    }
  }
  get ordered(): boolean {
    return this._ordered;
  }

  ngAfterViewInit(): void {
    this.createEditor();
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  /** Поставить курсор в конец содержимого. */
  focusEnd(): void {
    this.editor?.chain().focus('end').run();
  }

  /** Поставить курсор в начало содержимого. */
  focusStart(): void {
    this.editor?.chain().focus('start').run();
  }

  // ---- Внутреннее ----

  private createEditor(): void {
    const withLists = this.variant === 'text' || this.variant === 'list';
    this.editor = new Editor({
      element: this.host.nativeElement,
      extensions: [
        StarterKit.configure({
          heading:
            this.variant === 'text'
              ? { levels: [2, 3] }
              : this.variant === 'heading'
                ? { levels: [Number(this._headingLevel[1]) as 1 | 2 | 3 | 4] }
                : false,
          bulletList: withLists ? {} : false,
          orderedList: withLists ? {} : false,
          listItem: withLists ? {} : false,
          listKeymap: withLists ? {} : false,
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          strike: false,
          dropcursor: false,
          gapcursor: false,
          trailingNode: false,
          link: {
            openOnClick: false,
            autolink: true,
            HTMLAttributes: { rel: 'noopener noreferrer' },
          },
        }),
        Placeholder.configure({ placeholder: this.placeholder }),
      ],
      content: this.editorContent(),
      editorProps: {
        attributes: { class: 'canvas-text__area' },
        handleKeyDown: (_view, event) => this.handleKeyDown(event),
        handleDrop: (_view, event) => {
          // Перетаскивание блока канваса: не вставляем его данные в текст
          const types = event.dataTransfer?.types;
          return !!types && Array.from(types).includes('application/x-canvas-block');
        },
      },
      onUpdate: () => this.onEditorUpdate(),
      onSelectionUpdate: () => this.updateBubble(),
      onFocus: () => this.updateBubble(),
      onBlur: () => {
        window.setTimeout(() => {
          this.bubbleOpen = false;
          this.linkOpen = false;
          this.cdr.markForCheck();
        }, 160);
      },
    });
    this.initialized = true;
    if (this.autofocus) {
      this.focusEnd();
    }
  }

  private rebuild(): void {
    const value = this._value;
    const items = [...this._items];
    this.editor?.destroy();
    this.editor = null;
    this.createEditor();
    this._value = value;
    this._items = items;
    this.cdr.markForCheck();
  }

  /** HTML для редактора: у заголовка и цитаты значение хранится без обёртки. */
  private editorContent(): string {
    if (this.variant === 'heading') {
      return this._value ? `<${this._headingLevel}>${this._value}</${this._headingLevel}>` : '';
    }
    if (this.variant === 'quote') {
      return this._value ? `<p>${this._value}</p>` : '';
    }
    if (this.variant === 'list') {
      const tag = this._ordered ? 'ol' : 'ul';
      const items = this._items.length > 0 ? this._items : [''];
      return `<${tag}>${items.map((item) => `<li><p>${item}</p></li>`).join('')}</${tag}>`;
    }
    return this._value;
  }

  /** Значение из редактора: у заголовка и цитаты снимаем обёртку. */
  private unwrap(html: string): string {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const el = tpl.content.firstElementChild as HTMLElement | null;
    return el ? el.innerHTML : '';
  }

  private extractListItems(): string[] {
    const html = this.editor?.getHTML() ?? '';
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    return Array.from(tpl.content.querySelectorAll('li')).map((li) => {
      const first = li.firstElementChild as HTMLElement | null;
      return first ? first.innerHTML : (li as HTMLElement).innerHTML;
    });
  }

  private onEditorUpdate(): void {
    const editor = this.editor;
    if (!editor) {
      return;
    }
    if (this.variant === 'list') {
      const items = this.extractListItems();
      this._items = items;
      this.lastEmitted = JSON.stringify(items);
      this.listItemsChange.emit(items);
      this.cdr.markForCheck();
      return;
    }
    const html = this.variant === 'text' ? editor.getHTML() : this.unwrap(editor.getHTML());
    this._value = html;
    this.lastEmitted = html;
    this.valueChange.emit(html);
    this.cdr.markForCheck();
  }

  private applyExternalContent(): void {
    const editor = this.editor;
    if (!editor || editor.isFocused) {
      return;
    }
    if (this.variant === 'list') {
      if (JSON.stringify(this._items) === this.lastEmitted) {
        return;
      }
      editor.commands.setContent(this.editorContent() || '', { emitUpdate: false });
      return;
    }
    if (this._value === this.lastEmitted) {
      return;
    }
    editor.commands.setContent(this.editorContent() || '', { emitUpdate: false });
  }

  private handleKeyDown(event: KeyboardEvent): boolean {
    const editor = this.editor;
    if (!editor) {
      return false;
    }

    if (event.key === '/' && editor.isEmpty) {
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      this.slash.emit({ left: coords.left, top: coords.bottom });
      return true;
    }

    if (event.key === 'Backspace' && editor.isEmpty) {
      this.removeEmpty.emit();
      return true;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      if (this.variant === 'heading' || this.variant === 'quote') {
        this.newBlockAfter.emit();
        return true;
      }
      if (this.variant === 'text') {
        const { state } = editor;
        const { $from } = state.selection;
        const atEndOfParent = $from.parentOffset === $from.parent.content.size;
        const isLast = $from.depth === 1 && $from.index(0) === state.doc.childCount - 1;
        if (atEndOfParent && isLast && $from.parent.type.name === 'paragraph') {
          this.newBlockAfter.emit();
          return true;
        }
      }
    }

    return false;
  }

  // ---- Плавающий тулбар ----

  private updateBubble(): void {
    const editor = this.editor;
    if (!editor || this.variant === 'list') {
      this.bubbleOpen = false;
      return;
    }
    const { selection } = editor.state;
    if (selection.empty || !editor.isFocused) {
      this.bubbleOpen = false;
      this.linkOpen = false;
      this.cdr.markForCheck();
      return;
    }
    const wrapEl = this.wrap?.nativeElement ?? this.host.nativeElement;
    const wrapRect = wrapEl.getBoundingClientRect();
    const start = editor.view.coordsAtPos(selection.from);
    const end = editor.view.coordsAtPos(selection.to);
    this.bubbleLeft = Math.max(4, (start.left + end.left) / 2 - wrapRect.left);
    this.bubbleTop = Math.max(4, start.top - wrapRect.top - 46);
    this.bubbleOpen = true;
    this.cdr.markForCheck();
  }

  isActive(mark: 'bold' | 'italic' | 'underline' | 'link'): boolean {
    return this.editor?.isActive(mark) ?? false;
  }

  isHeading(level: 2 | 3): boolean {
    return this.editor?.isActive('heading', { level }) ?? false;
  }

  toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
    this.updateBubble();
  }

  toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
    this.updateBubble();
  }

  toggleUnderline(): void {
    this.editor?.chain().focus().toggleUnderline().run();
    this.updateBubble();
  }

  setHeading(level: 2 | 3): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
    this.updateBubble();
  }

  setParagraph(): void {
    this.editor?.chain().focus().setParagraph().run();
    this.updateBubble();
  }

  toggleBulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
    this.updateBubble();
  }

  toggleOrderedList(): void {
    this.editor?.chain().focus().toggleOrderedList().run();
    this.updateBubble();
  }

  openLink(): void {
    this.linkOpen = true;
    this.linkValue = (this.editor?.getAttributes('link')['href'] as string) ?? '';
    this.cdr.markForCheck();
  }

  onLinkInput(event: Event): void {
    this.linkValue = (event.target as HTMLInputElement).value;
  }

  applyLink(): void {
    const editor = this.editor;
    if (!editor) {
      return;
    }
    let href = this.linkValue.trim();
    if (href !== '' && !/^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
      href = 'https://' + href;
    }
    if (href === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    this.linkOpen = false;
    this.updateBubble();
  }

  cancelLink(): void {
    this.linkOpen = false;
    this.editor?.chain().focus().run();
    this.cdr.markForCheck();
  }

  clearFormat(): void {
    this.editor?.chain().focus().unsetAllMarks().setParagraph().run();
    this.updateBubble();
  }
}
