import { Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PageBlock, PageColumn, PageContent, PageSection } from '../../models/admin.model';
import { normalizePageContent, widthsStyle } from '../../utils/page-content.util';
import { FormRenderComponent } from '../form-render/form-render.component';
import { ServicesGridComponent } from '../services-grid/services-grid.component';
import { CasesGridComponent } from '../cases-grid/cases-grid.component';

@Component({
  selector: 'app-page-content',
  imports: [FormRenderComponent, ServicesGridComponent, CasesGridComponent],
  templateUrl: './page-content.html',
})
export class PageContentComponent {
  private readonly sanitizer = inject(DomSanitizer);

  sections: PageContent = [];

  @Input()
  set blocks(value: PageBlock[] | PageContent | null | undefined) {
    this.sections = normalizePageContent(value);
  }

  safeHtml(html: string): SafeHtml | null {
    return this.sanitizer.bypassSecurityTrustHtml(html ?? '');
  }

  /** Текст блока: простой текст оборачивается в абзац — так же, как в редакторе. */
  textHtml(html: string): SafeHtml | null {
    const value = (html ?? '').trim();
    if (value === '') {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }
    const hasBlocks = /<(p|h[1-6]|ul|ol|blockquote|div|figure|table|pre)\b/i.test(value);
    return this.sanitizer.bypassSecurityTrustHtml(hasBlocks ? value : `<p>${value}</p>`);
  }

  /** Соотношение колонок секции (null — равные). */
  widths(sec: PageSection): string | null {
    return widthsStyle(sec.widths, sec.cols.length);
  }

  /** Ограничение ширины формы (auto/100% — без ограничения). */
  formMaxWidth(block: PageBlock): string | null {
    if (block.type !== 'form') {
      return null;
    }
    const w = block.width;
    return w && w !== 'auto' && w !== '100%' ? w : null;
  }

  trackSection(_index: number, sec: PageSection): string {
    return sec.id;
  }

  trackColumn(_index: number, col: PageColumn): string {
    return col.id;
  }

  trackBlock(_index: number, block: PageBlock): string {
    return `${block.type}-${_index}`;
  }
}
