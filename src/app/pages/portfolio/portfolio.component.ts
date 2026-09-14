import { Component, OnInit } from '@angular/core';
import { CaseCardComponent } from '../../components/case-card/case-card.component';
import { LeadFormComponent } from '../../components/lead-form/lead-form.component';
import { ContentService } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';
import { PortfolioCase } from '../../models/content.model';

@Component({
  selector: 'app-portfolio',
  imports: [CaseCardComponent, LeadFormComponent],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
})
export class PortfolioComponent implements OnInit {
  cases: PortfolioCase[] = [];
  categories: string[] = [];
  activeCategory = 'all';

  constructor(
    private content: ContentService,
    private seo: SeoService,
  ) {}

  ngOnInit(): void {
    this.cases = this.content.getCases();
    this.categories = ['all', ...new Set(this.cases.map((c) => c.category))];
    this.seo.setSeo({
      title: 'Портфолио — примеры работ по сайтам, CRM, БД и автоматизации',
      description:
        'Реальные кейсы: разработка сайтов, внедрение CRM, оптимизация баз данных, автоматизация процессов и интеграции AI. Результаты в цифрах.',
      canonical: '/portfolio',
    });
  }

  get filteredCases(): PortfolioCase[] {
    return this.activeCategory === 'all'
      ? this.cases
      : this.cases.filter((c) => c.category === this.activeCategory);
  }

  setCategory(category: string): void {
    this.activeCategory = category;
  }
}
