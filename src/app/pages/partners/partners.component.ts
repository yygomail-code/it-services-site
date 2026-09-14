import { Component, OnInit } from '@angular/core';
import { LeadFormComponent } from '../../components/lead-form/lead-form.component';
import { ContentService } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';
import { PartnerRoleInfo } from '../../models/content.model';

@Component({
  selector: 'app-partners',
  imports: [LeadFormComponent],
  templateUrl: './partners.html',
  styleUrl: './partners.scss',
})
export class PartnersComponent implements OnInit {
  roles: PartnerRoleInfo[] = [];

  constructor(
    private content: ContentService,
    private seo: SeoService,
  ) {}

  ngOnInit(): void {
    this.roles = this.content.getPartnerRoles();
    this.seo.setSeo({
      title: 'Сотрудничество — партнёрство для дизайнеров, маркетологов и студий',
      description:
        'Приглашаю к сотрудничеству веб-дизайнеров, маркетологов, SEO-специалистов, студии и разработчиков. Вёрстка макетов, субподряд, партнёрская комиссия.',
      canonical: '/partners',
    });
  }
}
