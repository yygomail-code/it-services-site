import { Component, Input, inject } from '@angular/core';
import { CaseCardComponent } from '../case-card/case-card.component';
import { ContentService } from '../../services/content.service';
import { PortfolioCase } from '../../models/content.model';

@Component({
  selector: 'app-cases-grid',
  imports: [CaseCardComponent],
  templateUrl: './cases-grid.component.html',
  styleUrl: './cases-grid.component.scss',
})
export class CasesGridComponent {
  /** Сколько карточек показать (0 — все). */
  @Input() limit = 0;
  /** Показывать фильтр по категориям. */
  @Input() filters = false;

  private readonly content = inject(ContentService);
  readonly cases: PortfolioCase[] = this.content.getCases();
  readonly categories: string[] = ['all', ...new Set(this.cases.map((c) => c.category))];
  activeCategory = 'all';

  get visibleCases(): PortfolioCase[] {
    const list =
      this.activeCategory === 'all'
        ? this.cases
        : this.cases.filter((c) => c.category === this.activeCategory);
    return this.limit > 0 ? list.slice(0, this.limit) : list;
  }

  setCategory(category: string): void {
    this.activeCategory = category;
  }
}
