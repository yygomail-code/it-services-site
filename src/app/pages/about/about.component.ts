import { Component, OnInit } from '@angular/core';
import { LeadFormComponent } from '../../components/lead-form/lead-form.component';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-about',
  imports: [LeadFormComponent],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class AboutComponent implements OnInit {
  constructor(private seo: SeoService) {}

  ngOnInit(): void {
    this.seo.setSeo({
      title: 'Обо мне — разработчик сайтов, CRM, БД и автоматизации',
      description:
        'Опыт, стек и подход к работе: разработка сайтов, CRM-систем, баз данных и корпоративного софта. Работаю удалённо, возможен выезд к заказчику.',
      canonical: '/about',
    });
  }
}
