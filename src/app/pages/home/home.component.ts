import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { PageContentComponent } from '../../components/page-content/page-content.component';
import { SeoService } from '../../services/seo.service';
import { PageService } from '../../services/page.service';
import { PageBlock, PageSection } from '../../models/admin.model';

/** Главная: контент собирается в редакторе страниц (page «home»). */
@Component({
  selector: 'app-home',
  imports: [PageContentComponent],
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit {
  blocks: PageBlock[] | PageSection[] | null = null;

  private readonly seo = inject(SeoService);
  private readonly pages = inject(PageService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.seo.setSeo({
      title: 'Разработка и сопровождение сайтов, CRM, БД, корпоративного софта — ИТ-услуги',
      description:
        'Разработка сайтов, поддержка, CRM-системы, базы данных, корпоративный софт, интеграции AI. Удалённая работа и выезд к заказчику. Бесплатная консультация.',
    });

    this.pages.getBySlug('home').subscribe((page) => {
      if (page?.meta_title) {
        this.seo.setSeo({
          title: page.meta_title,
          description: page.meta_description || '',
          canonical: '/',
        });
      }
      this.blocks = page && Array.isArray(page.content) ? page.content : null;
      this.cdr.markForCheck();
    });
  }
}
