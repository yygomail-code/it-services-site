import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServiceCardComponent } from '../../components/service-card/service-card.component';
import { CaseCardComponent } from '../../components/case-card/case-card.component';
import { LeadFormComponent } from '../../components/lead-form/lead-form.component';
import { ContentService } from '../../services/content.service';
import { SeoService } from '../../services/seo.service';
import { PortfolioCase, Service } from '../../models/content.model';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ServiceCardComponent, CaseCardComponent, LeadFormComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent implements OnInit {
  services: Service[] = [];
  cases: PortfolioCase[] = [];

  heroTitle = '';
  heroSubtitle = '';

  constructor(
    public content: ContentService,
    private seo: SeoService,
  ) {}

  ngOnInit(): void {
    this.services = this.content.getServices();
    this.cases = this.content.getCases();
    this.heroTitle = this.content.get(
      'main.heroTitle',
      'Разработка сайтов, CRM и автоматизация, которые приводят клиентов',
    );
    this.heroSubtitle = this.content.get(
      'main.heroSubtitle',
      'Создаю сайты и системы, которые работают на ваш бизнес: привлекают заявки, ускоряют процессы и экономят время. Работаю удалённо по всей России, возможен выезд к заказчику.',
    );
    this.seo.setSeo({
      title: 'Разработка и сопровождение сайтов, CRM, БД, корпоративного софта — ИТ-услуги',
      description:
        'Разработка сайтов, поддержка, CRM-системы, базы данных, корпоративный софт, интеграции AI. Удалённая работа и выезд к заказчику. Бесплатная консультация.',
    });
  }
}