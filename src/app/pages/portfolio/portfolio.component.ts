import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { PageContentComponent } from '../../components/page-content/page-content.component';
import { SeoService } from '../../services/seo.service';
import { PageService } from '../../services/page.service';
import { PageBlock, PageSection } from '../../models/admin.model';

/** Портфолио: контент собирается в редакторе страниц (page «portfolio»). */
@Component({
  selector: 'app-portfolio',
  imports: [PageContentComponent],
  templateUrl: './portfolio.html',
})
export class PortfolioComponent implements OnInit {
  blocks: PageBlock[] | PageSection[] | null = null;

  private readonly seo = inject(SeoService);
  private readonly pages = inject(PageService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.seo.setSeo({
      title: 'Портфолио — примеры работ по сайтам, CRM, БД и автоматизации',
      description:
        'Реальные кейсы: разработка сайтов, внедрение CRM, оптимизация баз данных, автоматизация процессов и интеграции AI. Результаты в цифрах.',
      canonical: '/portfolio',
    });

    this.pages.getBySlug('portfolio').subscribe((page) => {
      if (page?.meta_title) {
        this.seo.setSeo({
          title: page.meta_title,
          description: page.meta_description || '',
          canonical: '/portfolio',
        });
      }
      this.blocks = page && Array.isArray(page.content) ? page.content : null;
      this.cdr.markForCheck();
    });
  }
}
